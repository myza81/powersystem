"""
Island Detection API Views

REST API endpoints for network island detection and analysis
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.models import IncomingBay
from services.island_detection import IslandDetectionService
from api.v1.serializers.island_detection import (
    IslandSimulationSerializer,
    IslandResultSerializer,
    CriticalBaySerializer,
    NetworkStatisticsSerializer,
)


class IslandDetectionViewSet(viewsets.ViewSet):
    """
    ViewSet for island detection and network analysis
    
    Endpoints:
    - POST /api/v1/island-detection/simulate/ - Simulate bay trip and find islands
    - GET /api/v1/island-detection/critical_bays/ - Get all critical bays
    - GET /api/v1/island-detection/network_stats/ - Get network statistics
    - POST /api/v1/island-detection/invalidate_cache/ - Invalidate graph cache
    """
    
    permission_classes = []  # Public access for now
    
    @action(detail=False, methods=['post'])
    def simulate(self, request):
        """
        Simulate tripping a bay and find resulting islands
        
        POST /api/v1/island-detection/simulate/
        
        Request Body:
        {
            "bay_id": "ADAM132_SRDN1",
            "main_grid_substation": "SRDN132"  // optional
        }
        
        Response:
        {
            "tripped_bay": "ADAM132_SRDN1",
            "from_substation": "ADAM132",
            "to_substation": "SRDN132",
            "isolated_substations": ["SDCA132", "BDNG132"],
            "isolated_count": 2,
            "still_connected": ["SRDN132", "AJYA132", ...],
            "still_connected_count": 139,
            "isolated_load_mw": 45.6,
            "isolated_load_mvar": 12.3,
            "is_critical": true
        }
        """
        serializer = IslandSimulationSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        bay_id = serializer.validated_data['bay_id']
        main_grid = serializer.validated_data.get('main_grid_substation', 'SRDN132')
        
        try:
            result = IslandDetectionService.find_islands(bay_id, main_grid)
            
            # Add load details
            load_impact = IslandDetectionService.calculate_load_impact(
                set(result['isolated_substations'])
            )
            result['load_details'] = load_impact['substations']
            
            return Response(result, status=status.HTTP_200_OK)
            
        except IncomingBay.DoesNotExist:
            return Response(
                {'error': f'Bay {bay_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Internal error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def critical_bays(self, request):
        """
        Get all critical bays (single points of failure)
        
        GET /api/v1/island-detection/critical_bays/
        
        Query Parameters:
        - main_grid_substation: str (default: SRDN132)
        - min_severity: float (optional) - Filter by minimum severity score
        - limit: int (optional) - Limit number of results
        
        Response:
        {
            "count": 15,
            "critical_bays": [
                {
                    "bay_id": "ADAM132_SRDN1",
                    "from_substation": "ADAM132",
                    "to_substation": "SRDN132",
                    "isolated_count": 5,
                    "isolated_substations": ["SDCA132", ...],
                    "isolated_load_mw": 120.5,
                    "isolated_load_mvar": 45.2,
                    "severity": 170.5
                },
                ...
            ]
        }
        """
        main_grid = request.query_params.get('main_grid_substation', 'SRDN132')
        min_severity = request.query_params.get('min_severity')
        limit = request.query_params.get('limit')
        
        try:
            critical_bays = IslandDetectionService.identify_critical_bays(main_grid)
            
            # Filter by minimum severity if specified
            if min_severity:
                try:
                    min_severity = float(min_severity)
                    critical_bays = [
                        bay for bay in critical_bays
                        if bay['severity'] >= min_severity
                    ]
                except ValueError:
                    return Response(
                        {'error': 'min_severity must be a number'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Limit results if specified
            if limit:
                try:
                    limit = int(limit)
                    critical_bays = critical_bays[:limit]
                except ValueError:
                    return Response(
                        {'error': 'limit must be an integer'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            return Response({
                'count': len(critical_bays),
                'critical_bays': critical_bays
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Internal error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def network_stats(self, request):
        """
        Get network topology statistics
        
        GET /api/v1/island-detection/network_stats/
        
        Response:
        {
            "total_substations": 141,
            "total_connections": 100,
            "avg_connections_per_substation": 1.42,
            "top_hubs": [
                {"substation_id": "SRDN132", "connection_count": 6},
                {"substation_id": "ADAM132", "connection_count": 4},
                ...
            ]
        }
        """
        try:
            stats = IslandDetectionService.get_network_statistics()
            return Response(stats, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Internal error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def invalidate_cache(self, request):
        """
        Invalidate the cached network graph
        
        POST /api/v1/island-detection/invalidate_cache/
        
        Call this after:
        - Validating new topology connections
        - Modifying existing connections
        - Adding new substations
        
        Response:
        {
            "message": "Cache invalidated successfully"
        }
        """
        try:
            IslandDetectionService.invalidate_cache()
            return Response(
                {'message': 'Cache invalidated successfully'},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            return Response(
                {'error': f'Internal error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def validate_bay(self, request):
        """
        Validate if a bay exists and has a connection
        
        GET /api/v1/island-detection/validate_bay/?bay_id=ADAM132_SRDN1
        
        Response:
        {
            "bay_id": "ADAM132_SRDN1",
            "exists": true,
            "has_connection": true,
            "from_substation": "ADAM132",
            "to_substation": "SRDN132",
            "validation_status": "VALIDATED"
        }
        """
        bay_id = request.query_params.get('bay_id')
        
        if not bay_id:
            return Response(
                {'error': 'bay_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            bay = IncomingBay.objects.select_related(
                'substation',
                'connected_to_substation'
            ).get(bay_id=bay_id)
            
            return Response({
                'bay_id': bay_id,
                'exists': True,
                'has_connection': bay.connected_to_substation is not None,
                'from_substation': bay.substation.substation_id,
                'to_substation': bay.connected_to_substation.substation_id if bay.connected_to_substation else None,
                'validation_status': bay.validation_status
            }, status=status.HTTP_200_OK)
            
        except IncomingBay.DoesNotExist:
            return Response({
                'bay_id': bay_id,
                'exists': False,
                'has_connection': False,
                'from_substation': None,
                'to_substation': None,
                'validation_status': None
            }, status=status.HTTP_200_OK)
