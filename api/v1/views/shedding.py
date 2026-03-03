from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
import os

from core.models import (
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
)
from api.v1.serializers.shedding import (
    LoadSheddingSettingSerializer,
    LoadSheddingVersionSerializer,
    LoadSheddingStageSerializer,
)

class BaseSheddingViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]

    def get_permissions(self):
        if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class LoadSheddingSettingViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingSetting.objects.all()
    serializer_class = LoadSheddingSettingSerializer


class LoadSheddingVersionViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingVersion.objects.all()
    serializer_class = LoadSheddingVersionSerializer
    search_fields = ['version_label']


class LoadSheddingStageViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingStage.objects.all()
    serializer_class = LoadSheddingStageSerializer
    search_fields = ['label']

    def get_queryset(self):
        queryset = super().get_queryset()
        version = self.request.query_params.get('version')
        if version:
            queryset = queryset.filter(version_id=version)
        return queryset
