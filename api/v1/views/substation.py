from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.models import Substation
from api.v1.serializers.substation import SubstationSerializer, SubstationDetailSerializer
from api.v1.permissions import IsStaffOrSuperuser
import os

class SubstationViewSet(viewsets.ModelViewSet):
    """
    V2: Substation ViewSet.
    Uses DetailSerializer for single-item lookups to provide equipment breakdown.
    """
    queryset = Substation.objects.all()
    serializer_class = SubstationSerializer

    def get_queryset(self):
        if self.action == 'retrieve':
            return Substation.objects.prefetch_related(
                'load_transformers',
                'auto_transformers',
                'incoming_branches__to_substation',
                'load_shedding_relays',
                'load_shedding_relays__load_transformers',
                'load_shedding_relays__auto_transformers',
                'load_shedding_relays__incoming_branches',
                'load_shedding_relays__incoming_branches__to_substation',
                'critical_assets',
                'critical_assets__category',
                'critical_assets__load_transformers',
            )

        if self.action == 'list':
            from core.models import CriticalAsset
            from django.db.models import Exists, OuterRef
            qs = Substation.objects.prefetch_related(
                'load_transformers',
                'load_shedding_relays',
                'critical_assets',
            )
            # Optional filter: only substations with at least one active critical asset
            if self.request.query_params.get('is_critical') in ('true', '1'):
                qs = qs.filter(
                    Exists(CriticalAsset.objects.filter(substation=OuterRef('pk'), is_inforce=True))
                )
            return qs

        return Substation.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SubstationDetailSerializer
        return SubstationSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == 'list':
            from core.models import LoadSheddingTransformerBay, LoadSheddingPocketBay, LoadSheddingPocketBoundary
            scheme_types_map = {}
            stages_map = {}

            active_published_version_filter = {
                'stage__version__status': 'active',
                'stage__version__is_active': True,
                'stage__version__published_at__isnull': False,
            }
            active_published_pocket_version_filter = {
                'pocket__stage__version__status': 'active',
                'pocket__stage__version__is_active': True,
                'pocket__stage__version__published_at__isnull': False,
            }

            # Transformer bays — relay__substation__substation_id is the live path;
            # frozen_substation_id is the fallback when the relay has been deleted (SET_NULL).
            tx_rows = (
                LoadSheddingTransformerBay.objects
                .filter(**active_published_version_filter)
                .select_related('stage__version', 'relay__substation')
                .values(
                    'relay__substation__substation_id',
                    'frozen_substation_id',
                    'stage__version__scheme_type',
                    'stage__stage_number',
                )
            )
            for row in tx_rows:
                sid = row['relay__substation__substation_id'] or row['frozen_substation_id']
                if not sid:
                    continue
                scheme_types_map.setdefault(sid, set()).add(row['stage__version__scheme_type'])
                stages_map.setdefault(sid, set()).add(row['stage__stage_number'])

            # Pocket bays — add every isolated substation (from topology_cache) to the
            # same maps so pocket substations appear when filtering by stage or scheme type.
            pocket_rows = (
                LoadSheddingPocketBay.objects
                .filter(**active_published_version_filter)
                .select_related('stage__version')
                .values('stage__version__scheme_type', 'stage__stage_number', 'topology_cache')
            )
            for pb in pocket_rows:
                cache = pb['topology_cache'] or {}
                scheme_type = pb['stage__version__scheme_type']
                stage_number = pb['stage__stage_number']
                for sid in cache.get('isolated_substations', []):
                    if sid:
                        scheme_types_map.setdefault(sid, set()).add(scheme_type)
                        stages_map.setdefault(sid, set()).add(stage_number)

            # Pocket boundaries are relay assignments too. These are not always present in
            # topology_cache, so include the boundary relay substation directly.
            boundary_rows = (
                LoadSheddingPocketBoundary.objects
                .filter(**active_published_pocket_version_filter)
                .select_related('pocket__stage__version', 'relay__substation')
                .values(
                    'relay__substation__substation_id',
                    'frozen_substation_id',
                    'pocket__stage__version__scheme_type',
                    'pocket__stage__stage_number',
                )
            )
            for row in boundary_rows:
                sid = row['relay__substation__substation_id'] or row['frozen_substation_id']
                if not sid:
                    continue
                scheme_types_map.setdefault(sid, set()).add(row['pocket__stage__version__scheme_type'])
                stages_map.setdefault(sid, set()).add(row['pocket__stage__stage_number'])

            ctx['scheme_types_map'] = scheme_types_map
            ctx['stages_map'] = stages_map
        return ctx

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsStaffOrSuperuser()]

    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'mnemonic', 'substation_id']
    
    def perform_create(self, serializer):
        """
        Auto-populate substation_id from mnemonic + voltage if not provided/read-only.
        Example: Mnemonic 'MWTA', Voltage 132 -> ID 'MWTA132'
        """
        mnemonic = serializer.validated_data.get('mnemonic')
        voltage = serializer.validated_data.get('voltage')
        
        if mnemonic and voltage:
             # Construct ID: e.g. MWTA + 132 = MWTA132
            substation_id = f"{mnemonic}{voltage}"
            serializer.save(substation_id=substation_id)
        elif mnemonic:
            # Fallback if voltage somehow missing
            serializer.save(substation_id=mnemonic)
        else:
            serializer.save()
    
    @action(detail=True, methods=['get'], url_path='view_sld')
    def view_sld(self, request, pk=None):
        """Serve SLD file for viewing"""
        substation = self.get_object()
        
        if not substation.sld_file:
            return Response(
                {"error": "No SLD file available for this substation"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        file_path = substation.sld_file.path
        file_url = request.build_absolute_uri(substation.sld_file.url)
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Determine file type
        if file_ext == '.pdf':
            return Response({
                'type': 'pdf',
                'url': file_url
            })
        elif file_ext == '.svg':
            # Default: avoid inlining SVG content (XSS risk if frontend injects into DOM).
            if settings.DEBUG and request.query_params.get('inline') in {'1', 'true', 'yes'}:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        svg_content = f.read()
                    return Response({'type': 'svg', 'content': svg_content})
                except Exception:
                    return Response(
                        {"error": "Failed to read SVG file"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

            return Response({'type': 'svg', 'url': file_url})
        elif file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
            return Response({
                'type': 'image',
                'url': file_url
            })
        elif file_ext == '.dxf':
            return Response({
                'type': 'dxf',
                'url': file_url,
                'message': 'DXF files require external viewer'
            })
        else:
            return Response({
                'type': 'unknown',
                'url': file_url
            })
    
    @action(detail=True, methods=['post'], url_path='upload_sld')
    def upload_sld(self, request, pk=None):
        """Upload SLD file for a substation"""
        substation = self.get_object()
        
        if 'sld_file' not in request.FILES:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['sld_file']
        if uploaded_file.size and uploaded_file.size > getattr(settings, 'MAX_UPLOAD_SIZE_BYTES', 20 * 1024 * 1024):
            return Response(
                {"error": "File too large"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        
        # Validate file type
        allowed_extensions = ['.pdf', '.svg', '.dxf', '.png', '.jpg', '.jpeg', '.gif', '.webp']
        if file_ext not in allowed_extensions:
            return Response(
                {"error": f"File must be PDF, Image, DXF, or SVG. Got: {file_ext}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Drop client-supplied name; only keep validated extension
        uploaded_file.name = f"sld{file_ext}"
        
        # Save the file
        substation.sld_file = uploaded_file
        substation.save()
        
        return Response({
            "message": "SLD file uploaded successfully",
            "sld_file": substation.sld_file.url if substation.sld_file else None
        }, status=status.HTTP_200_OK)
