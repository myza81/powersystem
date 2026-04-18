from rest_framework import viewsets, permissions, filters

from core.models import CriticalCategory, CriticalSource, CriticalAsset
from api.v1.serializers.critical import (
    CriticalCategorySerializer,
    CriticalSourceSerializer,
    CriticalAssetSerializer,
)
from api.v1.permissions import IsStaffOrSuperuser


class BaseCriticalViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsStaffOrSuperuser()]


class CriticalCategoryViewSet(BaseCriticalViewSet):
    queryset = CriticalCategory.objects.all().order_by('category_name')
    serializer_class = CriticalCategorySerializer
    search_fields = ['category_name', 'slug']


class CriticalSourceViewSet(BaseCriticalViewSet):
    queryset = CriticalSource.objects.all().order_by('-issued_date')
    serializer_class = CriticalSourceSerializer
    search_fields = ['source_file']


class CriticalAssetViewSet(BaseCriticalViewSet):
    queryset = CriticalAsset.objects.all().order_by('-created_at')
    serializer_class = CriticalAssetSerializer
    search_fields = ['asset', 'category__category_name']

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'category', 'source'
        ).prefetch_related('load_transformers')
        substation_id = self.request.query_params.get('substation')
        if substation_id:
            queryset = queryset.filter(substation__substation_id=substation_id)
        return queryset
