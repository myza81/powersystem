from rest_framework import viewsets, permissions, filters
from django.conf import settings
import os

from core.models import LoadTransformer, AutoTransformer, IncomingBranch, LoadSheddingRelay
from api.v1.serializers.substation import (
    LoadTransformerSerializer,
    AutoTransformerSerializer,
    IncomingBranchSerializer,
    LoadSheddingRelaySerializer,
)


class BaseBayAssetViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]

    def get_permissions(self):
        if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]


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
        queryset = super().get_queryset().order_by('substation__substation_id', '-id')
        substation = self.request.query_params.get('substation')
        if substation:
            queryset = queryset.filter(substation__substation_id=substation)
        return queryset

