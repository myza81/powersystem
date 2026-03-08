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

    def get_permissions(self):
        # Allow creating for all authenticated (or Any in debug)
        # But restrict delete/update to staff
        if self.action in ['destroy', 'update', 'partial_update']:
            if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
                return [permissions.AllowAny()]
            return [permissions.IsAdminUser()]
        return super().get_permissions()

    def _check_in_use(self, instance):
        from core.models import LoadSheddingStageSetting
        in_use = LoadSheddingStageSetting.objects.filter(
            setting=instance,
            version__status__in=['active', 'deactivated']
        ).exists()
        if in_use:
            raise Response({"error": "This setting is in use by a published version and cannot be modified or deleted."}, status=status.HTTP_400_BAD_VALUE_BASED_LOGIC)
        return False

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        from core.models import LoadSheddingStageSetting
        if LoadSheddingStageSetting.objects.filter(setting=instance, version__status__in=['active', 'deactivated']).exists():
            return Response({"error": "This setting is in use by a published version and cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        from core.models import LoadSheddingStageSetting
        if LoadSheddingStageSetting.objects.filter(setting=instance, version__status__in=['active', 'deactivated']).exists():
            return Response({"error": "This setting is in use by a published version and cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        from core.models import LoadSheddingStageSetting
        if LoadSheddingStageSetting.objects.filter(setting=instance, version__status__in=['active', 'deactivated']).exists():
            return Response({"error": "This setting is in use by a published version and cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)


class LoadSheddingVersionViewSet(BaseSheddingViewSet):
    queryset = LoadSheddingVersion.objects.all()
    serializer_class = LoadSheddingVersionSerializer
    search_fields = ['review_year']

    def get_queryset(self):
        user = self.request.user
        
        # For development with DJANGO_PUBLIC_API, act as staff
        is_dev_admin = settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}

        if (not user or user.is_anonymous) and not is_dev_admin:
            return LoadSheddingVersion.objects.none()
        
        # Admins can see everything
        if getattr(user, 'is_staff', False) or is_dev_admin:
            return LoadSheddingVersion.objects.all()
        
        # Global scope for active/deactivated, user scope for drafts
        from django.db.models import Q
        return LoadSheddingVersion.objects.filter(
            Q(status__in=['active', 'deactivated']) | Q(status='draft', created_by=user)
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Deleting active/deactivated only allowed via admin panel
        if instance.status in ['active', 'deactivated'] and not request.user.is_staff:
            return Response(
                {"error": "Deleting active or deactivated versions is only allowed via the admin panel."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        # Drafts can be deleted by owner
        if instance.status == 'draft' and instance.created_by != request.user and not request.user.is_staff:
            return Response(
                {"error": "You can only delete your own drafts."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        version = self.get_object()
        if not request.user.is_staff and version.created_by != request.user:
            return Response({"error": "You are not authorized to publish this draft."}, status=status.HTTP_403_FORBIDDEN)

        version.publish(user=request.user)
        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """
        Logic for 'Save as new version'. Clones the version and all its nested stages/bays.
        """
        original = self.get_object()
        
        # Create new version record (auto-increments via model save)
        new_version = LoadSheddingVersion.objects.create(
            scheme_type=original.scheme_type,
            review_year=original.review_year,
            status='draft',
            created_by=request.user,
            notes=f"Cloned from v{original.version}"
        )
        
        # Clone nested data
        for original_stage in original.stages.all():
            old_stage_id = original_stage.id
            
            # Create new stage
            new_stage = LoadSheddingStage.objects.create(
                version=new_version,
                stage_number=original_stage.stage_number,
                label=original_stage.label
            )
            
            # Clone Settings
            from core.models import LoadSheddingStageSetting
            for ss in LoadSheddingStageSetting.objects.filter(stage_id=old_stage_id):
                LoadSheddingStageSetting.objects.create(
                    stage=new_stage,
                    setting=ss.setting,
                    version=new_version
                )
            
            # Clone Transformer Bays
            for tb in original_stage.transformer_bays.all():
                old_tb_transformers = list(tb.transformers.all())
                new_tb = LoadSheddingTransformerBay.objects.create(
                    stage=new_stage,
                    relay=tb.relay
                )
                new_tb.transformers.set(old_tb_transformers)
            
            # Clone Pocket Bays
            for pb in original_stage.pocket_bays.all():
                old_pb_id = pb.id
                new_pb = LoadSheddingPocketBay.objects.create(
                    stage=new_stage,
                    topology_cache=pb.topology_cache,
                    topology_valid=pb.topology_valid,
                    topology_alert=pb.topology_alert
                )
                
                from core.models import LoadSheddingPocketBoundary
                for boundary in LoadSheddingPocketBoundary.objects.filter(pocket_id=old_pb_id):
                    old_branches = list(boundary.branches.all())
                    new_boundary = LoadSheddingPocketBoundary.objects.create(
                        pocket=new_pb,
                        relay=boundary.relay
                    )
                    new_boundary.branches.set(old_branches)

        return Response(self.get_serializer(new_version).data, status=status.HTTP_201_CREATED)


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
