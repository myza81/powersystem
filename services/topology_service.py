
from collections import defaultdict, deque
from typing import List, Set, Dict, Any, Optional
import logging
from django.db.models import Q
import django
from core.models import NetworkSnapshot, NetworkBus, NetworkBranch, NetworkTransformer, NetworkGenerator

logger = logging.getLogger(__name__)

class TopologyService:
    """
    Core service for Network Topology Analysis.
    Builds graph representation of the grid and identifies islands.
    """

    def __init__(self, snapshot: NetworkSnapshot):
        self.snapshot = snapshot
        self.adj = defaultdict(list)
        self.buses = {} # id -> bus object
        self.energized_sources = set()

    def build_graph(self):
        """
        Constructs the adjacency list from active branches and transformers.
        """
        logger.info(f"Building topology graph for snapshot: {self.snapshot.name}")
        
        # 1. Load Buses
        # We need all buses to map IDs and check basic properties
        buses_qs = NetworkBus.objects.filter(snapshot=self.snapshot)
        for bus in buses_qs:
            self.buses[bus.id] = bus
            # Identify potential sources (Swing Bus or Gen Bus)
            # PSS/E standard: Bus Type 3 = Swing. 
            # But we might not have `ide` field mapped. 
            # Alternatively, check NetworkGenerator existence.
        
        # 2. Identify Sources (Generators)
        # Energized islands must have at least one active generator
        gen_buses = NetworkGenerator.objects.filter(
            snapshot=self.snapshot, 
            in_service=True
        ).values_list('bus_id', flat=True)
        
        self.energized_sources = set(gen_buses)

        # 3. Add Branches (Edges)
        branches = NetworkBranch.objects.filter(
            snapshot=self.snapshot,
            is_active=True
        )
        for br in branches:
            u, v = br.from_bus_id, br.to_bus_id
            if u in self.buses and v in self.buses:
                self.adj[u].append(v)
                self.adj[v].append(u)

        # 4. Add Transformers (Edges)
        transformers = NetworkTransformer.objects.filter(
            snapshot=self.snapshot,
            is_active=True
        )
        for tx in transformers:
            u, v = tx.from_bus_id, tx.to_bus_id
            if u in self.buses and v in self.buses:
                self.adj[u].append(v)
                self.adj[v].append(u)
            
            # TODO: Handle 3-winding tertiary if modeled as connected node
            if tx.tertiary_bus_id:
                t = tx.tertiary_bus_id
                if t in self.buses:
                    # Star point connection model varies. 
                    # Assuming full connectivity for now (Mesh) for simplicity, 
                    # or Primary-Tertiary and Secondary-Tertiary?
                    # Winding 1-2, 1-3, 2-3 usually.
                    self.adj[u].append(t)
                    self.adj[t].append(u)
                    self.adj[v].append(t)
                    self.adj[t].append(v)

        logger.info(f"Graph built: {len(self.buses)} nodes, {len(branches) + len(transformers)} edges")

    def find_islands(self) -> List[Set[int]]:
        """
        Finds all connected components (islands) in the network.
        Returns a list of sets, where each set contains bus IDs.
        """
        visited = set()
        islands = []

        for bus_id in self.buses:
            if bus_id not in visited:
                component = set()
                queue = deque([bus_id])
                visited.add(bus_id)
                component.add(bus_id)

                while queue:
                    u = queue.popleft()
                    for v in self.adj[u]:
                        if v not in visited:
                            visited.add(v)
                            component.add(v)
                            queue.append(v)
                
                islands.append(component)

        return islands

    def analyze_islands(self) -> List[Dict[str, Any]]:
        """
        Returns detailed analysis of islands.
        Classification: 'Energized' (contains Gen) vs 'Dead'.
        """
        islands = self.find_islands()
        results = []

        for i, island_nodes in enumerate(islands):
            # Check for generation
            has_gen = not self.energized_sources.isdisjoint(island_nodes)
            
            # Calculate total load
            # Note: This requires pre-fetching loads or querying. 
            # For efficiency, we'd batch fetch, but for now simple query:
            # Check core.models NetworkLoad. But doing it efficiently:
            # We can aggregate per island.
            
            # Classify
            status = 'Energized' if has_gen else 'De-energized'
            
            # Simple heuristic for Main Grid: Largest Energized Island?
            # Or assume the island with the Swing Bus?
            # For now, just Energized/De-energized.
            
            # Identify Substations
            bus_objects = NetworkBus.objects.filter(id__in=island_nodes).select_related('substation')
            substation_map = {}
            orphan_buses = []

            for bus in bus_objects:
                if bus.substation:
                    if bus.substation.pk not in substation_map:
                        substation_map[bus.substation.pk] = {
                            'id': bus.substation.pk,
                            'name': bus.substation.name,
                            'code': bus.substation.code if hasattr(bus.substation, 'code') else '',
                            'bus_count': 0
                        }
                    substation_map[bus.substation.pk]['bus_count'] += 1
                else:
                    orphan_buses.append({
                        'id': bus.bus_number,
                        'name': bus.bus_name,
                        'kv': bus.base_kv,
                        'pk': bus.id
                    })
            
            sorted_subs = sorted(substation_map.values(), key=lambda x: x['name'])
            sorted_orphans = sorted(orphan_buses, key=lambda x: x['name'])

            results.append({
                'id': i + 1,
                'bus_count': len(island_nodes),
                'status': status,
                'bus_ids': list(island_nodes),
                'substations': sorted_subs,
                'substation_count': len(sorted_subs),
                'orphan_buses': sorted_orphans,
                'orphan_count': len(sorted_orphans)
            })
            
        # Detect Main Grid (heuristic: max bus count among energized)
        if results:
            energized = [r for r in results if r['status'] == 'Energized']
            if energized:
                main_grid = max(energized, key=lambda x: x['bus_count'])
                main_grid['status'] = 'Main Grid'

        return results

    def delete_buses(self, bus_ids: List[int]) -> int:
        """
        Permanently deletes the specified buses and their connected components.
        Used for cleaning up ghost islands/artifacts.
        """
        if not bus_ids:
            return 0
            
        # Safety check: prevent mass deletion unless explicitly bypassed?
        # For now, we trust the ID list from the frontend.
        
        with django.db.transaction.atomic():
            buses_to_delete = NetworkBus.objects.filter(
                snapshot=self.snapshot, 
                id__in=bus_ids
            )
            count, _ = buses_to_delete.delete()
            logger.info(f"Deleted {count} components including {len(bus_ids)} buses from snapshot {self.snapshot.id}")
            return count
