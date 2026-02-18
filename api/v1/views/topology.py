
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from services.island_detection_service import IslandDetectionService
from django.conf import settings
import os
import logging

from core.models import NetworkSnapshot
from services.topology_service import TopologyService

logger = logging.getLogger(__name__)

class TopologyViewSet(viewsets.ViewSet):
    """
    API for Network Topology Analysis.
    """
    def get_permissions(self):
        if settings.DEBUG or os.getenv("DJANGO_PUBLIC_API", "False").lower() in {"1", "true", "yes"}:
            return [AllowAny()]
        return [IsAuthenticated()]
    
    @action(detail=False, methods=['get'], url_path='islands')
    def get_islands(self, request):
        """
        Get detected islands for a snapshot.
        Query param: snapshot_id (required)
        """
        snapshot_id = request.query_params.get('snapshot_id')
        
        # Validate snapshot access
        snapshot = self._get_snapshot(request, snapshot_id)
        if not snapshot:
             return Response(
                {"error": "Snapshot not found or access denied"}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        try:
            # Pass validated snapshot ID to service
            result = IslandDetectionService.analyze_snapshot(snapshot.id)
            if 'error' in result:
                return Response(result, status=status.HTTP_404_NOT_FOUND)
            return Response(result)
        except Exception as e:
            logger.exception("Error checking islands")
            return Response(
                {"error": "Failed to analyze topology"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='cleanup')
    def cleanup_island(self, request):
        """
        Delete specified buses (cleanup ghost islands).
        Payload: { "snapshot_id": "uuid", "bus_ids": [1, 2] }
        """
        snapshot_id = request.data.get('snapshot_id')
        bus_ids = request.data.get('bus_ids', [])
        
        if not snapshot_id or not bus_ids:
            return Response(
                {"error": "snapshot_id and bus_ids required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Validate snapshot access
            snapshot = self._get_snapshot(request, snapshot_id)
            if not snapshot:
                 return Response(
                    {"error": "Snapshot not found or access denied"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            service = TopologyService(snapshot)
            count = service.delete_buses(bus_ids)
            
            return Response({
                "message": f"Successfully deleted {count} components",
                "deleted_count": count
            })
        except Exception as e:
            logger.exception("Cleanup failed")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_snapshot(self, request, snapshot_id=None):
        """Helper to get snapshot with user isolation"""
        from django.db.models import Q
        
        # Base query: Created by user OR Public (null)
        if request.user.is_authenticated:
            qs = NetworkSnapshot.objects.filter(
                Q(created_by=request.user) | Q(created_by__isnull=True)
            )
        else:
            qs = NetworkSnapshot.objects.filter(created_by__isnull=True)
            
        if snapshot_id:
            return qs.filter(id=snapshot_id).first()
        return qs.order_by('-timestamp').first()
