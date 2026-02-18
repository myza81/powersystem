
from services.topology_service import TopologyService
from core.models import NetworkSnapshot
import logging

logger = logging.getLogger(__name__)

class IslandDetectionService:
    """
    Orchestrates Island Detection for snapshots.
    Wraps TopologyService with business logic and metrics.
    """

    @staticmethod
    def analyze_snapshot(snapshot_id: str):
        try:
            snapshot = NetworkSnapshot.objects.get(id=snapshot_id)
        except NetworkSnapshot.DoesNotExist:
            return {'error': 'Snapshot not found'}

        service = TopologyService(snapshot)
        service.build_graph()
        
        islands = service.analyze_islands()
        
        # Check if we have any islands (more than 1 component)
        # Note: Even a single grid is 1 component.
        # "Island Detection" usually implies looking for *unintended* islands.
        
        # Add aggregation logic here if needed (e.g., total MW load per island)
        # This requires querying NetworkLoad filtering by bus_ids.
        
        return {
            'snapshot': snapshot.name,
            'timestamp': snapshot.timestamp,
            'island_count': len(islands),
            'islands': sorted(islands, key=lambda x: x['bus_count'], reverse=True)
        }
