import logging
from django.conf import settings
from django.utils import timezone
import os

from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import (
    ProtectionRelay,
    LoadSheddingScheme,
    SchemeVersion,
    ShedGroupSetting,
    ShedGroupAssignment,
)
from api.v1.serializers.shedding import (
    ProtectionRelaySerializer,
    LoadSheddingSchemeSerializer,
    SchemeVersionSerializer,
    SchemeVersionListSerializer,
    ShedGroupSettingSerializer,
    ShedGroupSettingWriteSerializer,
    ShedGroupAssignmentSerializer,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────
# Physical Relay Registry
# ──────────────────────────────────────────────────────────────────

class ProtectionRelayViewSet(viewsets.ModelViewSet):
    """
    CRUD for protection relay registry.
    Each row = one relay wired to one circuit.
    Filter: ?relay_type=UFLS, ?substation_id=BRGS132, ?assignment_type=branch
    """
    serializer_class = ProtectionRelaySerializer

    def get_queryset(self):
        qs = ProtectionRelay.objects.select_related('substation').order_by(
            'substation__substation_id', 'relay_type', 'relay_panel_id'
        )

        relay_type = self.request.query_params.get('relay_type')
        if relay_type:
            qs = qs.filter(relay_type=relay_type)

        substation_id = self.request.query_params.get('substation_id')
        if substation_id:
            qs = qs.filter(substation__substation_id=substation_id)

        assignment_type = self.request.query_params.get('assignment_type')
        if assignment_type:
            qs = qs.filter(assignment_type=assignment_type)

        return qs


# ──────────────────────────────────────────────────────────────────
# Load Shedding Schemes
# ──────────────────────────────────────────────────────────────────

class LoadSheddingSchemeViewSet(viewsets.ModelViewSet):
    """
    CRUD for top-level scheme documents (UFLS / UVLS / Manual).
    Global read. Write requires authentication.
    """
    serializer_class = LoadSheddingSchemeSerializer

    def get_queryset(self):
        qs = LoadSheddingScheme.objects.prefetch_related(
            'versions'
        ).select_related('created_by').order_by('scheme_type')

        scheme_type = self.request.query_params.get('scheme_type')
        if scheme_type:
            qs = qs.filter(scheme_type=scheme_type.upper())

        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)


class SchemeVersionViewSet(viewsets.ModelViewSet):
    """
    Versioned revisions of a LoadSheddingScheme.

    Access rules:
    - LIST / RETRIEVE (SchemeVersionView): global — all users see published (active) versions.
    - CREATE / PATCH / DELETE (ShedDesign): user-scoped — only the version owner can edit drafts.
    - publish action: supersedes the current active version.
    - simulate action: user-scoped; proxies to existing load-shedding-sim endpoint.

    Filter: ?scheme=<uuid>, ?scheme_type=UFLS, ?status=active
    """

    def get_queryset(self):
        user = self.request.user
        qs = SchemeVersion.objects.select_related(
            'scheme', 'published_by'
        ).prefetch_related(
            'groups__assignments__substation'
        ).order_by('-created_at')

        # Show active/superseded to anyone; drafts only to authenticated users
        if hasattr(user, 'is_authenticated') and user.is_authenticated:
            from django.db.models import Q
            qs = qs.filter(Q(status='active') | Q(status='superseded') | Q(published_by=user) | Q(status='draft'))
        else:
            qs = qs.filter(status__in=['active', 'superseded'])

        # Optional query filters
        scheme_id = self.request.query_params.get('scheme')
        if scheme_id:
            qs = qs.filter(scheme__id=scheme_id)

        scheme_type = self.request.query_params.get('scheme_type')
        if scheme_type:
            qs = qs.filter(scheme__scheme_type=scheme_type.upper())

        version_status = self.request.query_params.get('status')
        if version_status:
            qs = qs.filter(status=version_status)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return SchemeVersionListSerializer
        return SchemeVersionSerializer

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(published_by=user)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        """
        Publish this draft version.
        Sets status=active, supersedes previous active, records published_by/at.
        """
        version = self.get_object()
        try:
            version.publish(user=request.user if request.user.is_authenticated else None)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = SchemeVersionSerializer(version, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='simulate')
    def simulate(self, request, pk=None):
        """
        ShedSimulation entry point (user-scoped).
        Assembles the group payload from this version's assignments,
        applies any per-request operated/not-operated overrides,
        then proxies to the existing load-shedding-sim endpoint.

        Request body:
        {
            "snapshot_id": "<uuid>",
            "operated_assignment_ids": ["<uuid>", ...]  // only these are included
        }
        If operated_assignment_ids is omitted, all assignments are treated as operated.
        """
        version = self.get_object()
        snapshot_id = request.data.get('snapshot_id')
        operated_ids = request.data.get('operated_assignment_ids', None)

        if not snapshot_id:
            return Response({'error': 'snapshot_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build group payload from this version
        groups_payload = []
        for group in version.groups.prefetch_related('assignments').order_by('order'):
            assignments = group.assignments.all()
            if operated_ids is not None:
                assignments = assignments.filter(id__in=operated_ids)

            island_instructions = [
                f"{a.from_substation_id} - {a.to_substation_id} {a.circuit_id}"
                for a in assignments if a.assignment_type == 'branch'
            ]
            load_instructions = [
                f"{a.from_substation_id} {a.circuit_id}"
                for a in assignments if a.assignment_type == 'load_transformer'
            ]

            if island_instructions or load_instructions:
                groups_payload.append({
                    'name': group.name,
                    'island_instructions': island_instructions,
                    'load_instructions': load_instructions,
                    'include_autotransformers': group.include_autotransformers,
                })

        # Proxy to existing TopologyService (same pattern as topology.py view)
        from services.topology_service import TopologyService
        from core.models import NetworkSnapshot
        from django.db.models import Q

        # User-scoped snapshot access
        user = request.user
        if hasattr(user, 'is_authenticated') and user.is_authenticated:
            snapshot_qs = NetworkSnapshot.objects.filter(
                Q(created_by=user) | Q(created_by__isnull=True)
            )
        else:
            snapshot_qs = NetworkSnapshot.objects.filter(created_by__isnull=True)

        snapshot = snapshot_qs.filter(id=snapshot_id).first()
        if not snapshot:
            return Response({'error': 'Snapshot not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        if not groups_payload:
            return Response({'error': 'No operated assignments in this simulation.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = TopologyService(snapshot)
            results = []
            for group in groups_payload:
                group_spec = {
                    'island_instructions': group['island_instructions'],
                    'load_instructions': group['load_instructions'],
                    'include_autotransformers': group['include_autotransformers'],
                }
                results.append({
                    'name': group['name'],
                    'result': service.evaluate_shedding_group(group_spec),
                })
            return Response({'snapshot_id': snapshot_id, 'groups': results})
        except Exception as e:
            logger.error(f"Simulation failed for version {pk}: {e}")
            return Response({'error': 'Simulation failed.', 'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class ShedGroupSettingViewSet(viewsets.ModelViewSet):
    """
    CRUD for shed groups within a scheme version.
    Filter: ?version=<uuid>
    """
    def get_queryset(self):
        qs = ShedGroupSetting.objects.prefetch_related(
            'assignments__substation'
        ).select_related('version__scheme').order_by('version', 'order')

        version_id = self.request.query_params.get('version')
        if version_id:
            qs = qs.filter(version__id=version_id)

        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ShedGroupSettingWriteSerializer
        return ShedGroupSettingSerializer


class ShedGroupAssignmentViewSet(viewsets.ModelViewSet):
    """
    CRUD for individual circuit assignments within a shed group.
    Filter: ?group=<uuid>

    substation FK is auto-resolved on save() via model override.
    """
    serializer_class = ShedGroupAssignmentSerializer

    def get_queryset(self):
        qs = ShedGroupAssignment.objects.select_related(
            'group__version__scheme', 'substation'
        ).order_by('group', 'assignment_type', 'from_substation_id')

        group_id = self.request.query_params.get('group')
        if group_id:
            qs = qs.filter(group__id=group_id)

        return qs
