from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from core.models import Substation
from api.v1.serializers.substation import SubstationSerializer, SubstationDetailSerializer
import os

class SubstationViewSet(viewsets.ModelViewSet):
    """
    V2: Substation ViewSet.
    Uses DetailSerializer for single-item lookups to provide equipment breakdown.
    """
    queryset = Substation.objects.all()
    serializer_class = SubstationSerializer

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SubstationDetailSerializer
        return SubstationSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
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
            # Read SVG content
            try:
                with open(file_path, 'r') as f:
                    svg_content = f.read()
                return Response({
                    'type': 'svg',
                    'content': svg_content
                })
            except Exception as e:
                return Response(
                    {"error": f"Failed to read SVG file: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
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
        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        
        # Validate file type
        allowed_extensions = ['.pdf', '.svg', '.dxf', '.png', '.jpg', '.jpeg', '.gif', '.webp']
        if file_ext not in allowed_extensions:
            return Response(
                {"error": f"File must be PDF, Image, DXF, or SVG. Got: {file_ext}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save the file
        substation.sld_file = uploaded_file
        substation.save()
        
        return Response({
            "message": "SLD file uploaded successfully",
            "sld_file": substation.sld_file.url if substation.sld_file else None
        }, status=status.HTTP_200_OK)
