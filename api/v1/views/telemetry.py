"""
Telemetry API Views

Lightweight endpoints for real-time substation load data.
Optimized for sub-10ms response times using Redis cache.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from services.telemetry_cache import get_telemetry_cache
import logging

logger = logging.getLogger(__name__)


class TelemetryViewSet(viewsets.ViewSet):
    """
    ViewSet for real-time telemetry operations.
    
    Endpoints:
    - GET /telemetry/loads/ - Get all substation loads (lightweight)
    - GET /telemetry/loads/{substation_id}/ - Get specific substation load
    """
    
    @action(detail=False, methods=['get'])
    def loads(self, request):
        """
        Get all substation loads from cache.
        
        Response:
            [
                {
                    "id": "ABBA132",
                    "mw": 123.45,
                    "mvar": 34.56,
                    "ts": "2026-02-07T14:30:00.000Z"
                },
                ...
            ]
        
        Performance: ~8ms (no database queries)
        """
        try:
            cache = get_telemetry_cache()
            loads_dict = cache.get_all_loads()
            
            # Transform to array format for frontend
            loads_array = [
                {
                    "id": substation_id,
                    "mw": data["mw"],
                    "mvar": data["mvar"],
                    "ts": data["ts"]
                }
                for substation_id, data in loads_dict.items()
            ]
            
            return Response(loads_array, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Telemetry loads endpoint error: {e}")
            return Response(
                {"error": "Failed to retrieve telemetry data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def load(self, request, pk=None):
        """
        Get load data for a specific substation.
        
        Args:
            pk (str): Substation ID (e.g., "ABBA132")
        
        Response:
            {
                "id": "ABBA132",
                "mw": 123.45,
                "mvar": 34.56,
                "ts": "2026-02-07T14:30:00.000Z"
            }
        """
        if not pk:
            return Response(
                {"error": "Substation ID required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            cache = get_telemetry_cache()
            data = cache.get_load(pk)
            
            if not data:
                return Response(
                    {"error": f"No telemetry data for substation {pk}"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return Response({
                "id": pk,
                "mw": data["mw"],
                "mvar": data["mvar"],
                "ts": data["ts"]
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Telemetry load endpoint error for {pk}: {e}")
            return Response(
                {"error": "Failed to retrieve telemetry data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def aggregates(self, request):
        """
        Get aggregated metrics (region, state, ownership, grid totals).
        
        Response:
            {
                "regions": {
                    "Central": {"mw": 1234.5, "mvar": 345.6, "ts": "..."},
                    "North": {"mw": 890.1, "mvar": 234.5, "ts": "..."}
                },
                "states": {...},
                "ownership": {...},
                "grid": {"mw": 5678.9, "mvar": 1234.5, "ts": "..."}
            }
        
        Performance: ~10ms (no database queries)
        """
        try:
            cache = get_telemetry_cache()
            metrics = cache.get_aggregated_metrics()
            
            return Response(metrics, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Telemetry aggregates endpoint error: {e}")
            return Response(
                {"error": "Failed to retrieve aggregated metrics"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
