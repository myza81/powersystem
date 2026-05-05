from rest_framework import viewsets, permissions, filters

from core.models import LoadTransformer, AutoTransformer, IncomingBranch, LoadSheddingRelay
from api.v1.serializers.substation import (
    LoadTransformerSerializer,
    AutoTransformerSerializer,
    IncomingBranchSerializer,
    LoadSheddingRelaySerializer,
)
from api.v1.permissions import IsStaffOrSuperuser


class BaseBayAssetViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsStaffOrSuperuser()]


class LoadTransformerViewSet(BaseBayAssetViewSet):
    queryset = LoadTransformer.objects.all()
    serializer_class = LoadTransformerSerializer
    search_fields = ['bay_id', 'substation__substation_id']

    def get_queryset(self):
        queryset = super().get_queryset().order_by('substation__substation_id', 'transformer_no')
        substation = self.request.query_params.get('substation')
        if substation:
            queryset = queryset.filter(substation__substation_id=substation)
        return queryset


class AutoTransformerViewSet(BaseBayAssetViewSet):
    queryset = AutoTransformer.objects.all()
    serializer_class = AutoTransformerSerializer
    search_fields = ['bay_id', 'substation__substation_id']

    def get_queryset(self):
        queryset = super().get_queryset().order_by('substation__substation_id', 'transformer_no')
        substation = self.request.query_params.get('substation')
        if substation:
            queryset = queryset.filter(substation__substation_id=substation)
        return queryset


class IncomingBranchViewSet(BaseBayAssetViewSet):
    queryset = IncomingBranch.objects.all()
    serializer_class = IncomingBranchSerializer
    search_fields = ['bay_id', 'substation__substation_id', 'to_substation__substation_id']

    def get_queryset(self):
        queryset = super().get_queryset().order_by('substation__substation_id', 'to_substation__substation_id', 'ckt_id')
        substation = self.request.query_params.get('substation')
        if substation:
            queryset = queryset.filter(substation__substation_id=substation)
        return queryset


class LoadSheddingRelayViewSet(BaseBayAssetViewSet):
    queryset = LoadSheddingRelay.objects.all()
    serializer_class = LoadSheddingRelaySerializer
    search_fields = ['id', 'substation__substation_id']

    def get_queryset(self):
        queryset = super().get_queryset().select_related('substation').prefetch_related(
            'load_transformers__substation',
            'incoming_branches__substation',
            'incoming_branches__to_substation',
            'auto_transformers__substation',
        ).order_by('substation__substation_id', '-id')
        substation = self.request.query_params.get('substation')
        if substation:
            queryset = queryset.filter(substation__substation_id=substation)
        return queryset

