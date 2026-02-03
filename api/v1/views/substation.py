from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.models import Substation, Transformer, IncomingBay
from api.v1.serializers.substation import SubstationSerializer
from services.substation_sync import SubstationSyncService
import tempfile
import os
import logging
from django.db import transaction

logger = logging.getLogger(__name__)

class SubstationViewSet(viewsets.ModelViewSet):
    queryset = Substation.objects.all()
    serializer_class = SubstationSerializer
    authentication_classes = [] # Disable CSRF check for local dev
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        # Auto-generate substation_id before saving if manually creating
        validated_data = serializer.validated_data
        mnemonic = validated_data.get('mnemonic')
        voltage = validated_data.get('voltage')
        if mnemonic and voltage:
            substation_id = f"{mnemonic.upper()}{int(voltage)}"
            serializer.save(substation_id=substation_id)
        else:
            serializer.save()

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def upload_bulk(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # Extract extension from uploaded file
        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in ['.xlsx', '.xls', '.csv']:
            return Response({"error": "Unsupported file format. Use .xlsx or .csv"}, status=status.HTTP_400_BAD_REQUEST)

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            for chunk in file_obj.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            results = SubstationSyncService.sync_from_file(tmp_path)
            
            if 'error' in results:
                return Response(results, status=status.HTTP_400_BAD_REQUEST)

            # Add a summary field for easy UI display
            results['summary'] = f"Uploaded: {results['created']}, Duplicates: {results['duplicates_skipped']}, Invalid Grid: {results['invalid_grid_skipped']}"
            return Response(results, status=status.HTTP_200_OK)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_sld(self, request, pk=None):
        substation = self.get_object()
        sld_file = request.FILES.get('sld_file')
        
        if not sld_file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate file extension
        ext = os.path.splitext(sld_file.name)[1].lower().lstrip('.')
        if ext not in ['pdf', 'png', 'jpg', 'jpeg', 'dxf', 'svg']:
            return Response({"error": "Only PDF, Image, DXF, or SVG files are allowed"}, status=status.HTTP_400_BAD_REQUEST)

        substation.sld_file = sld_file
        substation.save()
        return Response(SubstationSerializer(substation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def process_sld(self, request, pk=None):
        """
        Process SLD using OCR + LLM/Fallback pipeline.
        
        POST Data (optional):
            - use_llm: boolean (default: True) - Use LLM reasoning or fallback
            - llm_provider: string (default: "auto") - "auto", "openai", "gemini", etc.
        """
        from services.sld_parser import SLDPipeline
        from services.sld_parser.validator import ValidationError
        
        substation = self.get_object()
        
        if not substation.sld_file:
            return Response(
                {"error": "No SLD file uploaded for this substation"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get parsing options from request
        use_llm = request.data.get('use_llm', True)
        llm_provider = request.data.get('llm_provider', 'auto')
        
        # FORCE FALLBACK FOR DXF:
        # Our deterministic vector parser is now highly optimized and 100% accurate for ABBA132.
        # The LLM is hallucinating values (e.g. 60MVA).
        if substation.sld_file.name.lower().endswith('.dxf'):
            logger.info("DXF detected - Forcing deterministic fallback parser for accuracy.")
            use_llm = False
        
        try:
            # 1. Parse SLD using new pipeline
            logger.info(f"Processing SLD for {substation.substation_id}")
            parsed_data = SLDPipeline.parse(
                substation.sld_file.path,
                use_llm=use_llm,
                llm_provider=llm_provider,
                validate=True
            )
            
            # 2. Update Database (Atomic transaction with soft-delete)
            with transaction.atomic():
                # Update Substation metadata if present
                if parsed_data.get('commission_date'):
                    substation.commission_date = parsed_data['commission_date']
                    substation.save()

                # Erase existing configuration permanently
                substation.transformers.all().delete()
                substation.incoming_bays.all().delete()
                
                # Save Transformers (Deduplicated by Name)
                created_transformers = 0
                seen_t_names = set()
                for t_data in parsed_data.get('transformers', []):
                    # Extracted ID is now treated as the BAY NAME (e.g. "T1")
                    raw_id = t_data.get('transformer_id')
                    if not raw_id or raw_id in seen_t_names:
                        continue
                    
                    seen_t_names.add(raw_id)
                    t_data.pop('id', None)
                    t_data.pop('transformer_id', None) # Remove ID, let model generate it
                    t_data.pop('_fallback_mode', None)
                    t_data.pop('_confidence_note', None)
                    
                    t_data['bay_name'] = raw_id
                    
                    try:
                        Transformer.objects.create(
                            substation=substation,
                            **t_data
                        )
                        created_transformers += 1
                    except Exception as e:
                        logger.error(f"Failed to save Transformer {raw_id}: {str(e)}")
                
                # Save Incoming Bays
                created_bays = 0
                save_errors = []
                seen_bay_names = set()
                
                for b_data in parsed_data.get('incoming_bays', []):
                    # Extracted ID is now treated as the BAY NAME (e.g. "SRDN1")
                    raw_id = b_data.get('bay_id')
                    if not raw_id or raw_id in seen_bay_names:
                        continue
                        
                    seen_bay_names.add(raw_id)
                    b_data.pop('id', None)
                    b_data.pop('bay_id', None) # Remove ID, let model generate it
                    clean_b_data = {k: v for k, v in b_data.items() if not k.startswith('_')}
                    
                    clean_b_data['bay_name'] = raw_id
                    
                    try:
                        IncomingBay.objects.create(
                            substation=substation,
                            **clean_b_data
                        )
                        created_bays += 1
                    except Exception as e:
                        msg = f"Failed to save Bay {raw_id}: {str(e)}"
                        logger.error(msg)
                        save_errors.append(msg)
                
                # Refresh to get newly created relations
                substation.refresh_from_db()
                
                logger.info(
                    f"Created {created_transformers} transformers, {created_bays} bays"
                )
            
            # 3. Return updated substation data
            response_data = SubstationSerializer(substation).data
            response_data["parsing_meta"] = {
                "mode": "llm" if use_llm else "fallback",
                "provider": llm_provider if use_llm else None,
                "transformers_created": created_transformers,
                "bays_created": created_bays,
                "fallback_note": parsed_data.get('_confidence_note'),
                "errors": save_errors
            }
            return Response(response_data, status=status.HTTP_200_OK)
            
        except ValidationError as e:
            logger.error(f"SLD validation failed: {str(e)}")
            return Response(
                {"error": f"Validation failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"SLD processing failed: {str(e)}", exc_info=True)
            return Response(
                {"error": f"Processing failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
