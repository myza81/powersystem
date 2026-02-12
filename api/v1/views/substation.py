from rest_framework import viewsets, permissions, filters
from core.models import Substation
from api.v1.serializers.substation import SubstationSerializer

class SubstationViewSet(viewsets.ModelViewSet):
    """
    V2: Simplified Substation ViewSet (Master Data only).
    V1 functionality (transformers, incoming bays) removed.
    """
    queryset = Substation.objects.all()
    serializer_class = SubstationSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'mnemonic', 'substation_id']
