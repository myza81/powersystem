from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.db import models
from django.core.files.storage import default_storage
from django.core.files import File
from django.utils import timezone
from services.import_service_v2 import ImportServiceV2
from services.island_detection_service import IslandDetectionService
from core.models import NetworkSnapshot, NetworkBranch
from api.v1.serializers.snapshot import SnapshotSerializer
import os
import uuid
import logging

logger = logging.getLogger(__name__)

class SnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = SnapshotSerializer
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        if self.request.user.is_authenticated:
            # Users can see their own snapshots AND public/legacy ones (NULL owner)
            return NetworkSnapshot.objects.filter(
                models.Q(created_by=self.request.user) | 
                models.Q(created_by__isnull=True)
            )
        # Unauthenticated users see only public/legacy snapshots (or none, depending on policy)
        return NetworkSnapshot.objects.filter(created_by__isnull=True)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        file_obj = request.FILES['file']
        name = request.data.get('name', file_obj.name)
        description = request.data.get('description', '')

        if file_obj.size and file_obj.size > getattr(settings, 'MAX_UPLOAD_SIZE_BYTES', 20 * 1024 * 1024):
            return Response(
                {"error": "File too large"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        ext = os.path.splitext(file_obj.name)[1].lower()
        if ext not in {'.raw'}:
            return Response(
                {"error": "Unsupported file type (expected .raw)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            head = file_obj.read(2048).decode(errors='ignore')
            file_obj.seek(0)
        except Exception:
            return Response(
                {"error": "Failed to read uploaded file"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "BEGIN BUS DATA" not in head and "0 /" not in head:
            return Response(
                {"error": "Invalid .raw file format"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save file temporarily
        tmp_name = f"tmp/uploads/{uuid.uuid4().hex}{ext}"
        file_path = default_storage.save(tmp_name, file_obj)
        full_path = default_storage.path(file_path)

        try:
            # Run import service
            user = request.user if request.user.is_authenticated else None
            snapshot = ImportServiceV2.import_raw_file(full_path, name, description, user=user)
            
            # Link the file to the snapshot
            # We need to re-open the file to save it to the model field, or just move it?
            # Since ImportServiceV2 creates the snapshot, we can update it.
            # Ideally, we should have passed the file to the service, but the service takes a path.
            # We can just update the source_file field with the path relative to MEDIA_ROOT?
            # Or re-save the file to the model.
            
            with open(full_path, 'rb') as f:
                snapshot.source_file.save(f"{uuid.uuid4().hex}{ext}", File(f))
                snapshot.save()

            self._set_active_snapshot(snapshot)

            summary = self._build_upload_summary(snapshot)
            serializer = self.get_serializer(snapshot)
            return Response({
                "snapshot": serializer.data,
                "summary": summary,
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.exception("Snapshot upload/import failed")
            return Response(
                {"error": "Failed to import snapshot"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            # Clean up temp file
            try:
                default_storage.delete(file_path)
            except Exception:
                logger.exception("Failed to delete temp upload")

    @action(detail=False, methods=['post'], url_path='activate')
    def activate(self, request):
        snapshot_id = request.data.get('snapshot_id')
        if not snapshot_id:
            return Response({"error": "snapshot_id required"}, status=status.HTTP_400_BAD_REQUEST)

        snapshot = self.get_queryset().filter(id=snapshot_id).first()
        if not snapshot:
            return Response({"error": "Snapshot not found or access denied"}, status=status.HTTP_404_NOT_FOUND)

        self._set_active_snapshot(snapshot)
        serializer = self.get_serializer(snapshot)
        summary = self._build_upload_summary(snapshot)
        return Response({"snapshot": serializer.data, "summary": summary})

    def _build_upload_summary(self, snapshot: NetworkSnapshot):
        metadata = snapshot.metadata or {}
        unmatched = metadata.get('unmatched_mnemonics', {})
        from core.models import NetworkBus, NetworkLoad
        from django.db.models import Sum

        unmapped_buses = NetworkBus.objects.filter(
            snapshot=snapshot,
            substation__isnull=True,
        )
        load_map = {
            row['bus_id']: {
                'p_mw': row['total_p_mw'] or 0.0,
                'q_mvar': row['total_q_mvar'] or 0.0,
            }
            for row in NetworkLoad.objects.filter(snapshot=snapshot, in_service=True)
                .values('bus_id')
                .annotate(total_p_mw=Sum('p_mw'), total_q_mvar=Sum('q_mvar'))
        }

        missing_buses = []
        for bus in unmapped_buses:
            totals = load_map.get(bus.id, {'p_mw': 0.0, 'q_mvar': 0.0})
            missing_buses.append({
                'bus_id': bus.id,
                'bus_number': bus.bus_number,
                'bus_name': bus.bus_name,
                'base_kv': bus.base_kv,
                'substation_id': None,
                'substation_name': None,
                'load_p_mw': round(totals['p_mw'], 6),
                'load_q_mvar': round(totals['q_mvar'], 6),
            })

        missing_substations = {
            "count": len(unmatched),
            "items": unmatched,
            "bus_count": len(missing_buses),
            "buses": sorted(missing_buses, key=lambda x: x['bus_number']),
            "total_load_mw": round(sum(b['load_p_mw'] for b in missing_buses), 6),
            "total_load_mvar": round(sum(b['load_q_mvar'] for b in missing_buses), 6),
        }

        try:
            island_result = IslandDetectionService.analyze_snapshot(str(snapshot.id))
        except Exception:
            logger.exception("Failed to analyze islands for snapshot")
            island_result = {"error": "Island detection failed"}

        try:
            from services.topology_service import TopologyService
            topology_tree = TopologyService(snapshot).build_network_topology_tree()
        except Exception:
            logger.exception("Failed to build topology tree for snapshot")
            topology_tree = {"error": "Topology tree generation failed"}


        return {
            "missing_substations": missing_substations,
            "islands": island_result,
            "network_topology": topology_tree,
        }

    def _set_active_snapshot(self, snapshot: NetworkSnapshot):
        qs = NetworkSnapshot.objects.all()
        if snapshot.created_by_id:
            qs = qs.filter(created_by=snapshot.created_by)
        else:
            qs = qs.filter(created_by__isnull=True)

        qs.exclude(id=snapshot.id).update(is_active=False)
        snapshot.is_active = True
        snapshot.activated_at = timezone.now()
        snapshot.save(update_fields=["is_active", "activated_at"])
