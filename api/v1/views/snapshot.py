from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files import File
from services.import_service_v2 import ImportServiceV2
from core.models import NetworkSnapshot
from api.v1.serializers.snapshot import SnapshotSerializer
import os
import uuid
import logging

logger = logging.getLogger(__name__)

class SnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = SnapshotSerializer
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)

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

            serializer = self.get_serializer(snapshot)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

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
