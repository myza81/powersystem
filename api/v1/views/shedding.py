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
    LoadSheddingTransformerBay,
    LoadSheddingPocketBay,
    LoadSheddingPocketBoundary,
)
from api.v1.serializers.shedding import (
    LoadSheddingSettingSerializer,
    LoadSheddingVersionSerializer,
    LoadSheddingStageSerializer,
    LoadSheddingStageDetailSerializer,
    LoadSheddingTransformerBaySerializer,
    LoadSheddingPocketBaySerializer,
    LoadSheddingPocketBoundarySerializer,
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

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        version = self.get_object()
        if not request.user.is_staff:
            return Response({"error": "Only admins can publish versions."}, status=status.HTTP_403_FOR_CONTENT)

        version.publish(user=request.user)
        return Response(self.get_serializer(version).data)


class LoadSheddingStageViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingStage.objects.all()
    serializer_class = LoadSheddingStageSerializer
    search_fields = ['label']

    def get_serializer_class(self):
        if self.action == 'retrieve' or self.request.query_params.get('include_bays') == 'true':
            return LoadSheddingStageDetailSerializer
        return LoadSheddingStageSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        version = self.request.query_params.get('version')
        if version:
            queryset = queryset.filter(version_id=version)
        return queryset


class LoadSheddingTransformerBayViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingTransformerBay.objects.all()
    serializer_class = LoadSheddingTransformerBaySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        stage = self.request.query_params.get('stage')
        relay = self.request.query_params.get('relay')
        if stage:
            queryset = queryset.filter(stage_id=stage)
        if relay:
            queryset = queryset.filter(relay_id=relay)
        return queryset


class LoadSheddingPocketBayViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingPocketBay.objects.all()
    serializer_class = LoadSheddingPocketBaySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        stage = self.request.query_params.get('stage')
        if stage:
            queryset = queryset.filter(stage_id=stage)
        return queryset


class LoadSheddingPocketBoundaryViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingPocketBoundary.objects.all()
    serializer_class = LoadSheddingPocketBoundarySerializer
