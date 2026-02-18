
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
        if not snapshot_id:
            return Response(
                {"error": "snapshot_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            result = IslandDetectionService.analyze_snapshot(snapshot_id)
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
            snapshot = NetworkSnapshot.objects.get(id=snapshot_id)
            service = TopologyService(snapshot)
            count = service.delete_buses(bus_ids)
            
            return Response({
                "message": f"Successfully deleted {count} components",
                "deleted_count": count
            })
        except NetworkSnapshot.DoesNotExist:
            return Response({"error": "Snapshot not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("Cleanup failed")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
