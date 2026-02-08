"""
Island Detection Service

Efficient graph-based service for detecting isolated substation pockets
when transmission bays are tripped.

Uses:
- Adjacency list representation for O(V+E) performance
- Breadth-First Search (BFS) for island detection
- Django cache for real-time performance
- Pre-computation of critical bays

Time Complexity: O(V + E) where V = substations, E = connections
For 141 substations with ~850 connections: ~1000 operations
"""

from collections import defaultdict, deque
from django.core.cache import cache
from django.utils import timezone
from django.db.models import Sum
import copy

from core.models import IncomingBay, Substation, BayLoad


class IslandDetectionService:
    """
    Service for detecting network islands when bays are tripped
    
    Key Features:
    - Graph-based topology representation
    - BFS algorithm for island detection
    - Cached graph for performance
    - Load impact calculation
    """
    
    CACHE_KEY = 'network_topology_graph'
    CACHE_TTL = 300  # 5 minutes
    
    @classmethod
    def build_network_graph(cls):
        """
        Build adjacency list representation of the network
        
        Time Complexity: O(B) where B = total validated bays
        
        Returns:
            dict: {substation_id: set(connected_substation_ids)}
        
        Example:
            {
                'SRDN132': {'ADAM132', 'AJYA132'},
                'ADAM132': {'SRDN132', 'SDCA132'},
                'SDCA132': {'ADAM132'}
            }
        """
        graph = defaultdict(set)
        
        # Get all validated connections
        validated_bays = IncomingBay.objects.filter(
            validation_status__in=['VALIDATED', 'AUTO_VALIDATED'],
            connected_to_substation__isnull=False
        ).select_related('substation', 'connected_to_substation')
        
        # Build bidirectional edges (undirected graph)
        for bay in validated_bays:
            from_id = bay.substation.substation_id
            to_id = bay.connected_to_substation.substation_id
            
            # Add edge in both directions
            graph[from_id].add(to_id)
            graph[to_id].add(from_id)
        
        # Convert defaultdict to regular dict for caching
        return {k: v for k, v in graph.items()}
    
    @classmethod
    def get_graph(cls):
        """
        Get cached network graph or rebuild if stale
        
        Returns:
            dict: Network adjacency list
        """
        graph = cache.get(cls.CACHE_KEY)
        
        if graph is None:
            graph = cls.build_network_graph()
            cache.set(cls.CACHE_KEY, graph, cls.CACHE_TTL)
        
        return graph
    
    @classmethod
    def invalidate_cache(cls):
        """
        Invalidate the cached graph
        
        Call this when:
        - Topology connections are validated/modified
        - New substations are added
        - Connections are changed
        """
        cache.delete(cls.CACHE_KEY)
    
    @classmethod
    def find_islands(cls, tripped_bay_id, main_grid_substation='SRDN132'):
        """
        Find all substations that become isolated when a bay is tripped
        
        Uses Breadth-First Search (BFS) to traverse the network from the
        main grid connection point, identifying which substations remain
        connected and which become isolated.
        
        Time Complexity: O(V + E) where V = substations, E = connections
        For 141 substations: ~1000 operations
        
        Args:
            tripped_bay_id (str): Bay ID to simulate tripping (e.g., 'ADAM132_SRDN1')
            main_grid_substation (str): Main grid connection point (default: 'SRDN132')
        
        Returns:
            dict: {
                'tripped_bay': str,
                'from_substation': str,
                'to_substation': str,
                'isolated_substations': list[str],
                'isolated_count': int,
                'still_connected': list[str],
                'still_connected_count': int,
                'isolated_load_mw': float,
                'isolated_load_mvar': float,
                'is_critical': bool
            }
        
        Raises:
            IncomingBay.DoesNotExist: If bay_id not found
            ValueError: If bay is not validated or has no connection
        """
        # Get the bay to trip
        try:
            bay = IncomingBay.objects.select_related(
                'substation',
                'connected_to_substation'
            ).get(bay_id=tripped_bay_id)
        except IncomingBay.DoesNotExist:
            raise IncomingBay.DoesNotExist(f"Bay {tripped_bay_id} not found")
        
        # Validate bay has a connection
        if not bay.connected_to_substation:
            raise ValueError(f"Bay {tripped_bay_id} has no validated connection")
        
        # Get network graph
        graph = cls.get_graph()
        
        # Get connection details
        from_id = bay.substation.substation_id
        to_id = bay.connected_to_substation.substation_id
        
        # Create modified graph (remove tripped connection)
        modified_graph = {k: v.copy() for k, v in graph.items()}
        
        if from_id in modified_graph:
            modified_graph[from_id].discard(to_id)
        if to_id in modified_graph:
            modified_graph[to_id].discard(from_id)
        
        # BFS from main grid to find all reachable substations
        visited = set()
        queue = deque([main_grid_substation])
        visited.add(main_grid_substation)
        
        while queue:
            current = queue.popleft()
            
            # Visit all neighbors
            for neighbor in modified_graph.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        # Calculate isolated substations
        all_substations = set(modified_graph.keys())
        isolated = all_substations - visited
        
        # Calculate load impact
        load_impact = cls.calculate_load_impact(isolated)
        
        return {
            'tripped_bay': tripped_bay_id,
            'from_substation': from_id,
            'to_substation': to_id,
            'isolated_substations': sorted(list(isolated)),
            'isolated_count': len(isolated),
            'still_connected': sorted(list(visited)),
            'still_connected_count': len(visited),
            'isolated_load_mw': load_impact['total_mw'],
            'isolated_load_mvar': load_impact['total_mvar'],
            'is_critical': len(isolated) > 0  # Critical if any substations isolated
        }
    
    @classmethod
    def calculate_load_impact(cls, isolated_substation_ids):
        """
        Calculate total load impact for isolated substations
        
        Args:
            isolated_substation_ids (set): Set of isolated substation IDs
        
        Returns:
            dict: {
                'total_mw': float,
                'total_mvar': float,
                'substations': list[dict]
            }
        """
        if not isolated_substation_ids:
            return {
                'total_mw': 0.0,
                'total_mvar': 0.0,
                'substations': []
            }
        
        # Get all substations with their loads
        substations = Substation.objects.filter(
            substation_id__in=isolated_substation_ids
        ).prefetch_related('transformers__load_data', 'incoming_bays__load_data')
        
        total_mw = 0.0
        total_mvar = 0.0
        substation_details = []
        
        for sub in substations:
            # Calculate substation load
            sub_mw = 0.0
            sub_mvar = 0.0
            
            # Sum transformer loads
            for transformer in sub.transformers.all():
                if hasattr(transformer, 'load_data') and transformer.load_data:
                    sub_mw += transformer.load_data.pload_mw or 0.0
                    sub_mvar += transformer.load_data.qload_mvar or 0.0
            
            # Sum incoming bay loads
            for bay in sub.incoming_bays.all():
                if hasattr(bay, 'load_data') and bay.load_data:
                    sub_mw += bay.load_data.pload_mw or 0.0
                    sub_mvar += bay.load_data.qload_mvar or 0.0
            
            total_mw += sub_mw
            total_mvar += sub_mvar
            
            substation_details.append({
                'substation_id': sub.substation_id,
                'name': sub.name,
                'load_mw': round(sub_mw, 2),
                'load_mvar': round(sub_mvar, 2)
            })
        
        return {
            'total_mw': round(total_mw, 2),
            'total_mvar': round(total_mvar, 2),
            'substations': sorted(substation_details, key=lambda x: x['load_mw'], reverse=True)
        }
    
    @classmethod
    def identify_critical_bays(cls, main_grid_substation='SRDN132'):
        """
        Identify all critical bays (single points of failure)
        
        A critical bay is one whose tripping would cause network islands.
        These are "bridges" in graph theory terms.
        
        Time Complexity: O(B * (V + E)) where B = validated bays
        For 100 validated bays: ~100,000 operations
        
        Recommendation: Run this as a background job (daily/weekly)
        
        Args:
            main_grid_substation (str): Main grid connection point
        
        Returns:
            list[dict]: List of critical bays with impact details
        """
        critical_bays = []
        
        # Get all validated bays
        validated_bays = IncomingBay.objects.filter(
            validation_status__in=['VALIDATED', 'AUTO_VALIDATED'],
            connected_to_substation__isnull=False
        ).select_related('substation', 'connected_to_substation')
        
        # Test each bay
        for bay in validated_bays:
            try:
                result = cls.find_islands(bay.bay_id, main_grid_substation)
                
                # If tripping this bay causes islands, it's critical
                if result['is_critical']:
                    critical_bays.append({
                        'bay_id': bay.bay_id,
                        'from_substation': result['from_substation'],
                        'to_substation': result['to_substation'],
                        'isolated_count': result['isolated_count'],
                        'isolated_substations': result['isolated_substations'],
                        'isolated_load_mw': result['isolated_load_mw'],
                        'isolated_load_mvar': result['isolated_load_mvar'],
                        'severity': cls._calculate_severity(result)
                    })
            except (ValueError, IncomingBay.DoesNotExist):
                continue
        
        # Sort by severity (highest first)
        critical_bays.sort(key=lambda x: x['severity'], reverse=True)
        
        return critical_bays
    
    @classmethod
    def _calculate_severity(cls, island_result):
        """
        Calculate severity score for a critical bay
        
        Factors:
        - Number of isolated substations (weight: 10)
        - Isolated load MW (weight: 1)
        
        Args:
            island_result (dict): Result from find_islands()
        
        Returns:
            float: Severity score
        """
        substation_score = island_result['isolated_count'] * 10
        load_score = island_result['isolated_load_mw']
        
        return substation_score + load_score
    
    @classmethod
    def get_network_statistics(cls):
        """
        Get overall network topology statistics
        
        Returns:
            dict: Network statistics
        """
        graph = cls.get_graph()
        
        total_substations = len(graph)
        total_connections = sum(len(neighbors) for neighbors in graph.values()) // 2
        
        # Find substations with most connections (hubs)
        connection_counts = {
            sub_id: len(neighbors)
            for sub_id, neighbors in graph.items()
        }
        
        hubs = sorted(
            connection_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            'total_substations': total_substations,
            'total_connections': total_connections,
            'avg_connections_per_substation': round(total_connections * 2 / total_substations, 2) if total_substations > 0 else 0,
            'top_hubs': [
                {'substation_id': sub_id, 'connection_count': count}
                for sub_id, count in hubs
            ]
        }
