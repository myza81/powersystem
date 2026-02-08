# Network Topology - Island Detection & Pocket Identification

**Version**: 1.0  
**Last Updated**: 2026-02-08  
**Status**: Design Phase

---

## End Goal

**Identify isolated pockets/groups of substations when specific incoming bays are tripped.**

This enables:
- 🔌 **Island Detection**: Which substations lose power
- ⚡ **Load Loss Calculation**: Total MW affected
- 🔗 **Network Analysis**: Spur vs radial connections
- 🛡️ **Load Shedding**: Intelligent cascading analysis

---

## Use Cases

### Use Case 1: Spur Connection

**Scenario**: Trip `PKLG132_NKST1` and `PKLG132_NKST2`

```
PKLG132 ──NKST1──> NKST132 ──> IGBK132
        └─NKST2──┘
```

**Result**: 
- **Isolated Substations**: `NKST132`, `IGBK132`
- **Reason**: Spur connection - NKST has only one supply point (PKLG)
- **Total MW Loss**: Sum of NKST + IGBK loads

### Use Case 2: Radial Connection

**Scenario**: Trip `CHNG132_BMKA1`, `CHNG132_BMKA2`, `MJYA132_BVTA1`, `MJYA132_BVTA2`

```
CHNG132 ──BMKA1──> BMKA132 ──> MMKA132 ──> BVTA132 <──BVTA1── MJYA132
        └─BMKA2──┘                                  └─BVTA2──┘
         (head)                                       (tail)
```

**Result**:
- **Isolated Substations**: `BMKA132`, `MMKA132`, `BVTA132`
- **Reason**: Radial line - tripping both head and tail isolates the pocket
- **Total MW Loss**: Sum of BMKA + MMKA + BVTA loads

---

## Network Graph Model

### Graph Representation

```python
# Nodes: Substations
# Edges: Incoming Bay connections

Graph = {
    'PKLG132': {
        'NKST132': ['PKLG132_NKST1', 'PKLG132_NKST2'],  # Multiple bays to same substation
    },
    'NKST132': {
        'IGBK132': ['NKST132_IGBK1'],
        'PKLG132': ['NKST132_PKLG1'],  # Reverse connection
    },
    'CHNG132': {
        'BMKA132': ['CHNG132_BMKA1', 'CHNG132_BMKA2'],
    },
    'BMKA132': {
        'MMKA132': ['BMKA132_MMKA1'],
        'CHNG132': ['BMKA132_CHNG1'],  # Reverse
    },
    'MMKA132': {
        'BVTA132': ['MMKA132_BVTA1'],
        'BMKA132': ['MMKA132_BMKA1'],  # Reverse
    },
    'BVTA132': {
        'MJYA132': ['BVTA132_MJYA1'],
        'MMKA132': ['BVTA132_MMKA1'],  # Reverse
    },
}
```

---

## Island Detection Algorithm

### Algorithm 1: Remove Edges and Find Islands

```python
class IslandDetectionService:
    
    @classmethod
    def find_isolated_substations(cls, tripped_bay_ids):
        """
        Given a list of tripped bay IDs, find all isolated substations
        
        Args:
            tripped_bay_ids: List of bay_id strings (e.g., ['PKLG132_NKST1', 'PKLG132_NKST2'])
        
        Returns:
            {
                'isolated_substations': [Substation, ...],
                'total_mw': float,
                'network_type': 'spur' | 'radial' | 'mixed',
                'islands': [
                    {
                        'substations': [Substation, ...],
                        'mw': float,
                        'reason': 'Lost connection to grid'
                    },
                    ...
                ]
            }
        """
        # Step 1: Build network graph
        graph = cls.build_network_graph()
        
        # Step 2: Remove tripped bays from graph
        active_graph = cls.remove_tripped_bays(graph, tripped_bay_ids)
        
        # Step 3: Find connected components (islands)
        islands = cls.find_connected_components(active_graph)
        
        # Step 4: Identify which islands lost grid connection
        isolated_islands = cls.identify_isolated_islands(islands)
        
        # Step 5: Calculate total MW
        total_mw = sum(island['mw'] for island in isolated_islands)
        
        return {
            'isolated_substations': [s for island in isolated_islands for s in island['substations']],
            'total_mw': total_mw,
            'islands': isolated_islands,
        }
    
    @classmethod
    def build_network_graph(cls):
        """Build bidirectional graph from IncomingBay connections"""
        from core.models import IncomingBay, Substation
        
        graph = defaultdict(lambda: defaultdict(list))
        
        # Get all validated connections
        bays = IncomingBay.objects.filter(
            validation_status__in=['VALIDATED', 'AUTO_VALIDATED'],
            is_active=True
        ).select_related('substation', 'connected_to_substation')
        
        for bay in bays:
            if bay.connected_to_substation:
                # Add edge: substation -> connected_to
                graph[bay.substation.substation_id][bay.connected_to_substation.substation_id].append(bay.bay_id)
                
                # Add reverse edge (bidirectional)
                graph[bay.connected_to_substation.substation_id][bay.substation.substation_id].append(bay.bay_id)
            
            # Handle tee-offs
            for tee_off_ss in bay.tee_off_connections.all():
                graph[bay.substation.substation_id][tee_off_ss.substation_id].append(bay.bay_id)
                graph[tee_off_ss.substation_id][bay.substation.substation_id].append(bay.bay_id)
        
        return graph
    
    @classmethod
    def remove_tripped_bays(cls, graph, tripped_bay_ids):
        """Remove tripped bays from graph"""
        active_graph = defaultdict(lambda: defaultdict(list))
        tripped_set = set(tripped_bay_ids)
        
        for source, destinations in graph.items():
            for dest, bay_ids in destinations.items():
                # Keep only non-tripped bays
                active_bays = [bay_id for bay_id in bay_ids if bay_id not in tripped_set]
                
                # Only keep edge if at least one bay is still active
                if active_bays:
                    active_graph[source][dest] = active_bays
        
        return active_graph
    
    @classmethod
    def find_connected_components(cls, graph):
        """Find all connected components (islands) using BFS"""
        visited = set()
        islands = []
        
        all_nodes = set(graph.keys())
        for destinations in graph.values():
            all_nodes.update(destinations.keys())
        
        for node in all_nodes:
            if node not in visited:
                # BFS to find all nodes in this island
                island = cls.bfs(graph, node, visited)
                islands.append(island)
        
        return islands
    
    @classmethod
    def bfs(cls, graph, start_node, visited):
        """Breadth-first search to find connected component"""
        from collections import deque
        
        queue = deque([start_node])
        island = []
        
        while queue:
            node = queue.popleft()
            
            if node in visited:
                continue
            
            visited.add(node)
            island.append(node)
            
            # Add neighbors
            for neighbor in graph.get(node, {}).keys():
                if neighbor not in visited:
                    queue.append(neighbor)
        
        return island
    
    @classmethod
    def identify_isolated_islands(cls, islands):
        """
        Identify which islands are isolated from the grid
        Assumes grid-connected substations have specific markers
        """
        from core.models import Substation
        
        isolated = []
        
        # Define grid-connected substations (e.g., generation sources, main grid tie points)
        # This could be a field on Substation model: is_grid_source
        grid_sources = Substation.objects.filter(
            is_grid_source=True  # TODO: Add this field
        ).values_list('substation_id', flat=True)
        
        grid_source_set = set(grid_sources)
        
        for island in islands:
            island_set = set(island)
            
            # Check if this island has any grid source
            has_grid_connection = bool(island_set & grid_source_set)
            
            if not has_grid_connection:
                # This island is isolated!
                substations = Substation.objects.filter(substation_id__in=island)
                total_mw = sum(ss.total_pload_mw for ss in substations)
                
                isolated.append({
                    'substations': list(substations),
                    'substation_ids': island,
                    'mw': total_mw,
                    'reason': 'Lost connection to grid',
                })
        
        return isolated
```

---

## Enhanced IncomingBay Model

Add reverse lookup capability:

```python
class IncomingBay(models.Model):
    # ... existing fields ...
    
    @property
    def reverse_connections(self):
        """Get all bays from other substations that connect to this substation"""
        if not self.connected_to_substation:
            return []
        
        return IncomingBay.objects.filter(
            connected_to_substation=self.substation,
            validation_status__in=['VALIDATED', 'AUTO_VALIDATED'],
            is_active=True
        )
```

---

## API Endpoints

### Identify Isolated Substations

```http
POST /api/v1/topology/identify-islands/
{
    "tripped_bays": [
        "PKLG132_NKST1",
        "PKLG132_NKST2"
    ]
}

Response:
{
    "isolated_substations": [
        {
            "substation_id": "NKST132",
            "name": "NKST Substation",
            "mw": 45.2
        },
        {
            "substation_id": "IGBK132",
            "name": "IGBK Substation",
            "mw": 32.8
        }
    ],
    "total_mw": 78.0,
    "islands": [
        {
            "substations": ["NKST132", "IGBK132"],
            "mw": 78.0,
            "reason": "Lost connection to grid"
        }
    ]
}
```

---

## Use Cases for Load Shedding

### Integration with LoadSheddingBayAction

```python
class LoadSheddingBayAction(models.Model):
    # ... existing fields ...
    
    @property
    def cascading_substations_with_islands(self):
        """
        Enhanced cascading analysis including island detection
        """
        affected = []
        
        # Direct effect
        if self.transformer:
            affected.append({
                'substation': self.relay.substation,
                'type': 'direct',
                'load_mw': self.current_load_mw,
            })
        
        # Island detection for incoming bays
        elif self.incoming_bay:
            # Find all bays to same destination
            related_bays = IncomingBay.objects.filter(
                substation=self.incoming_bay.substation,
                connected_to_substation=self.incoming_bay.connected_to_substation,
                is_active=True
            )
            
            # Simulate tripping all related bays
            tripped_bay_ids = [bay.bay_id for bay in related_bays]
            
            # Run island detection
            result = IslandDetectionService.find_isolated_substations(tripped_bay_ids)
            
            for island in result['islands']:
                affected.append({
                    'type': 'island',
                    'substations': island['substations'],
                    'load_mw': island['mw'],
                    'reason': island['reason'],
                })
        
        return affected
```

---

## Performance Considerations

### Optimization Strategies

1. **Graph Caching**: Cache network graph, rebuild only when topology changes
2. **Incremental Updates**: Update graph incrementally when bays added/removed
3. **Precomputed Islands**: Precompute common trip scenarios
4. **Parallel Processing**: Run island detection in background for complex scenarios

### Expected Performance

- **Graph Build**: <2 seconds for 1000 substations
- **Island Detection**: <1 second for typical scenarios
- **Complex Analysis**: <5 seconds for multiple trip scenarios

---

## Next Steps

1. ✅ Complete basic topology detection (Phase 1)
2. ⏭️ Add `is_grid_source` field to Substation model
3. ⏭️ Implement `IslandDetectionService`
4. ⏭️ Create API endpoints for island detection
5. ⏭️ Integrate with load shedding analysis
6. ⏭️ Build visualization for network graph

---

**Last Updated**: 2026-02-08  
**Status**: Design Complete, Ready for Implementation
