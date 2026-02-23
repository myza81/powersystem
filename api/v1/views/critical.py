from rest_framework import viewsets, permissions, filters
from django.conf import settings
import os

from core.models import CriticalCategory, CriticalSource, CriticalAssetTag
from api.v1.serializers.critical import (
    CriticalCategorySerializer,
    CriticalSourceSerializer,
    CriticalAssetTagSerializer,
)


class BaseCriticalViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]

    def get_permissions(self):
        if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]


class CriticalCategoryViewSet(BaseCriticalViewSet):
    queryset = CriticalCategory.objects.all().order_by('category_name')
    serializer_class = CriticalCategorySerializer
    search_fields = ['category_name', 'slug']


class CriticalSourceViewSet(BaseCriticalViewSet):
    queryset = CriticalSource.objects.all().order_by('-issued_date', 'reference')
    serializer_class = CriticalSourceSerializer
    search_fields = ['reference']


class CriticalAssetTagViewSet(BaseCriticalViewSet):
    queryset = CriticalAssetTag.objects.select_related('substation', 'load_transformer', 'category', 'source')
    serializer_class = CriticalAssetTagSerializer
    search_fields = ['substation__substation_id', 'load_transformer__bay_id', 'category__category_name']

    def get_queryset(self):
        queryset = super().get_queryset().order_by('substation__substation_id', 'load_transformer__bay_id')
        substation_id = self.request.query_params.get('substation')
        if substation_id:
            queryset = queryset.filter(substation__substation_id=substation_id)
        return queryset
