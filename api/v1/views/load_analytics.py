from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count
from core.models import NetworkSnapshot, NetworkLoad, TopologyBus, SnapshotBusState


class LoadAnalyticsViewSet(viewsets.ViewSet):
    """
    V2 Load Analytics API
    Provides aggregated load data from NetworkLoad model
    """
    
    @action(detail=False, methods=['get'])
    def aggregate(self, request):
        """
        GET /api/v1/load-analytics/aggregate/
        
        Substation-centric aggregation using NetworkLoad → TopologyBus → Substation chain.
        
        Query params:
        - snapshot_id: UUID of snapshot (optional, uses latest if not provided)
        
        Returns:
        {
            "snapshot_id": "uuid",
            "snapshot_name": "Feb 2026 Test",
            "timestamp": "2026-02-12T15:06:00Z",
            "total_pload_mw": 28208.17,
            "total_qload_mvar": 5682.47,
            "load_count": 1971,
            "substation_count": 156,
            "regional_breakdown": [...],
            "state_breakdown": [...],
            "ownership_breakdown": [...],
            "unlinked_loads": {...},
            "coverage": {...}
        }
        """
        from django.db.models import Sum, Count, Q
        from core.models import Substation
        
        snapshot_id = request.query_params.get('snapshot_id')
        
        # Get snapshot with user isolation
        snapshot = self._get_snapshot(request, snapshot_id)
        
        if not snapshot:
            return Response({'error': 'No accessible snapshots found'}, status=404)
        
        # Get all loads and linked loads
        all_loads = snapshot.loads.all()
        linked_loads = snapshot.loads.filter(bus__substation__isnull=False)
        unlinked_loads = snapshot.loads.filter(bus__substation__isnull=True)
        
        # Calculate internal grid totals (substation-linked loads only)
        overall_totals = linked_loads.aggregate(
            total_pload_mw=Sum('p_mw'),
            total_qload_mvar=Sum('q_mvar'),
            load_count=Count('id')
        )
        
        # Count unique substations with loads
        substation_count = (
            Substation.objects
            .filter(
                topology_buses__topology_version=snapshot.topology_version,
                topology_buses__loads__snapshot=snapshot,
            )
            .distinct()
            .count()
        )
        
        # Regional breakdown - aggregate loads by substation region
        regional_breakdown = []
        regional_data = (
            linked_loads
            .values('bus__substation__region')
            .annotate(
                total_pload_mw=Sum('p_mw'),
                total_qload_mvar=Sum('q_mvar'),
                load_count=Count('id')
            )
            .order_by('bus__substation__region')
        )
        
        for item in regional_data:
            region = item['bus__substation__region']
            if region and item['total_pload_mw']:
                # Count substations in this region
                region_substation_count = (
                    Substation.objects
                    .filter(
                        topology_buses__topology_version=snapshot.topology_version,
                        topology_buses__loads__snapshot=snapshot,
                        region=region
                    )
                    .distinct()
                    .count()
                )
                
                regional_breakdown.append({
                    'region': region,
                    'total_pload_mw': round(item['total_pload_mw'], 2),
                    'total_qload_mvar': round(item['total_qload_mvar'], 2),
                    'substation_count': region_substation_count,
                    'load_count': item['load_count']
                })
        
        # State breakdown - aggregate loads by substation state
        state_breakdown = []
        state_data = (
            linked_loads
            .values('bus__substation__state')
            .annotate(
                total_pload_mw=Sum('p_mw'),
                total_qload_mvar=Sum('q_mvar'),
                load_count=Count('id')
            )
            .order_by('bus__substation__state')
        )
        
        for item in state_data:
            state = item['bus__substation__state']
            if state and state.strip() and item['total_pload_mw']:
                # Count substations in this state
                state_substation_count = (
                    Substation.objects
                    .filter(
                        topology_buses__topology_version=snapshot.topology_version,
                        topology_buses__loads__snapshot=snapshot,
                        state=state
                    )
                    .distinct()
                    .count()
                )
                
                state_breakdown.append({
                    'state': state.strip(),
                    'total_pload_mw': round(item['total_pload_mw'], 2),
                    'total_qload_mvar': round(item['total_qload_mvar'], 2),
                    'substation_count': state_substation_count,
                    'load_count': item['load_count']
                })
        
        # Ownership breakdown - aggregate loads by substation ownership
        ownership_breakdown = []
        ownership_data = (
            linked_loads
            .values('bus__substation__ownership')
            .annotate(
                total_pload_mw=Sum('p_mw'),
                total_qload_mvar=Sum('q_mvar'),
                load_count=Count('id')
            )
            .order_by('bus__substation__ownership')
        )
        
        for item in ownership_data:
            ownership = item['bus__substation__ownership']
            if ownership and ownership.strip() and item['total_pload_mw']:
                # Count substations with this ownership
                ownership_substation_count = (
                    Substation.objects
                    .filter(
                        topology_buses__topology_version=snapshot.topology_version,
                        topology_buses__loads__snapshot=snapshot,
                        ownership=ownership
                    )
                    .distinct()
                    .count()
                )
                
                ownership_breakdown.append({
                    'ownership': ownership.strip(),
                    'total_pload_mw': round(item['total_pload_mw'], 2),
                    'total_qload_mvar': round(item['total_qload_mvar'], 2),
                    'substation_count': ownership_substation_count,
                    'load_count': item['load_count']
                })
        
        # Calculate unlinked loads totals
        unlinked_totals = unlinked_loads.aggregate(
            total_pload_mw=Sum('p_mw'),
            total_qload_mvar=Sum('q_mvar'),
            load_count=Count('id')
        )
        
        return Response({
            'snapshot_id': str(snapshot.id),
            'snapshot_name': snapshot.name,
            'timestamp': snapshot.timestamp,
            
            # Overall grid totals (including unlinked loads)
            'total_pload_mw': round(overall_totals['total_pload_mw'] or 0, 2),
            'total_qload_mvar': round(overall_totals['total_qload_mvar'] or 0, 2),
            'load_count': overall_totals['load_count'],
            'substation_count': substation_count,
            
            # Breakdowns (substation-linked loads only)
            'regional_breakdown': regional_breakdown,
            'state_breakdown': state_breakdown,
            'ownership_breakdown': ownership_breakdown,
            
            # Unlinked loads (explicitly shown)
            'unlinked_loads': {
                'total_pload_mw': round(unlinked_totals['total_pload_mw'] or 0, 2),
                'total_qload_mvar': round(unlinked_totals['total_qload_mvar'] or 0, 2),
                'load_count': unlinked_totals['load_count'] or 0
            },
            
            # Coverage metrics
            'coverage': {
                'total_loads': all_loads.count(),
                'loads_with_substations': linked_loads.count(),
                'coverage_percent': round(linked_loads.count() / all_loads.count() * 100, 1) if all_loads.count() > 0 else 0
            }
        })
    
    @action(detail=False, methods=['get'], url_path='network-links')
    def network_links(self, request):
        """
        GET /api/v1/load-analytics/network-links/
        
        Returns aggregated branch and transformer connections between substations
        based on the active topology version of the provided snapshot.
        """
        from core.models import TopologyBranch, TopologyTransformer
        from collections import defaultdict
        from django.db import models
        
        snapshot_id = request.query_params.get('snapshot_id')
        snapshot = self._get_snapshot(request, snapshot_id)
        
        if not snapshot or not snapshot.topology_version_id:
            return Response({'error': 'No snapshot or topology version found'}, status=404)
        
        tv_id = snapshot.topology_version_id
        
        # We need branches where BOTH ends are attached to a known substation
        # and from_sub != to_sub
        branches = TopologyBranch.objects.filter(
            topology_version_id=tv_id,
            is_active=True,
            from_bus__substation__isnull=False,
            to_bus__substation__isnull=False
        ).exclude(
            from_bus__substation=models.F('to_bus__substation')
        ).select_related('from_bus', 'to_bus')
        
        transformers = TopologyTransformer.objects.filter(
            topology_version_id=tv_id,
            is_active=True,
            from_bus__substation__isnull=False,
            to_bus__substation__isnull=False
        ).exclude(
            from_bus__substation=models.F('to_bus__substation')
        ).select_related('from_bus', 'to_bus')
        
        # Group links by pair (SubstationA, SubstationB)
        # Pair must be sorted to treat A->B and B->A as the same link
        links = defaultdict(lambda: {
            'voltage_kv': 0,
            'circuit_count': 0,
            'types': set()
        })
        
        for b in branches:
            sub1 = b.from_bus.substation_id
            sub2 = b.to_bus.substation_id
            k = tuple(sorted([sub1, sub2]))
            
            vk = max(b.from_bus.base_kv, b.to_bus.base_kv)
            links[k]['voltage_kv'] = max(links[k]['voltage_kv'], vk)
            links[k]['circuit_count'] += 1
            links[k]['types'].add('branch')
            
        for t in transformers:
            sub1 = t.from_bus.substation_id
            sub2 = t.to_bus.substation_id
            k = tuple(sorted([sub1, sub2]))
            
            vk = max(t.from_bus.base_kv, t.to_bus.base_kv)
            links[k]['voltage_kv'] = max(links[k]['voltage_kv'], vk)
            links[k]['circuit_count'] += 1
            links[k]['types'].add('transformer')
            
        res_list = []
        for (sub1, sub2), data in links.items():
            res_list.append({
                'from_substation_id': sub1,
                'to_substation_id': sub2,
                'voltage_kv': data['voltage_kv'],
                'circuit_count': data['circuit_count'],
                'type': 'mixed' if len(data['types']) > 1 else list(data['types'])[0]
            })
            
        return Response({
            'snapshot_id': str(snapshot.id),
            'topology_version_id': str(tv_id),
            'link_count': len(res_list),
            'links': res_list
        })

    
    @action(detail=False, methods=['get'], url_path='missing-substations')
    def missing_substations(self, request):
        """
        GET /api/v1/load-analytics/missing-substations/
        
        Returns detached buses (unmapped to substations) with detailed analytics
        (Load MW, Connectivity) to verify if they are ghost data.
        """
        from django.db.models import Sum, Count
        
        snapshot_id = request.query_params.get('snapshot_id')
        
        # Get snapshot with user isolation
        snapshot = self._get_snapshot(request, snapshot_id)
        
        if not snapshot:
            return Response({'error': 'No accessible snapshots found'}, status=404)
        
        # Query Live Data (Transmission Level unmapped buses)
        # We focus on > 33kV to avoid cluttering with distribution feeders if any exist
        bus_ids = SnapshotBusState.objects.filter(snapshot=snapshot).values_list('bus_id', flat=True)
        unmapped_buses = TopologyBus.objects.filter(
            id__in=bus_ids,
            substation__isnull=True,
            base_kv__gt=33,
        ).prefetch_related('loads', 'branches_from', 'branches_to', 'generators')
        
        # Group by Mnemonic (Extracted from Name)
        from collections import defaultdict
        import re
        
        grouped = defaultdict(list)
        
        for bus in unmapped_buses:
            # Extract Mnemonic
            match = re.search(r'([A-Z]+)', bus.bus_name.strip())
            # ... (rest of logic is fine, just need to ensure indentation is correct)
            if match:
                mnemonic = match.group(1)
            else:
                mnemonic = bus.bus_name.strip()[:4].upper()
            
            if re.search(r'(FIC|TEMP|TMP|FICT)', bus.bus_name, re.IGNORECASE):
                continue
            
            # Calculate Load
            total_load_mw = sum(l.p_mw for l in bus.loads.filter(snapshot=snapshot))
            total_gen_mw = sum(g.p_gen for g in bus.generators.filter(snapshot=snapshot))
            
            # Connectivity
            branch_count = bus.branches_from.count() + bus.branches_to.count()
            
            grouped[mnemonic].append({
                'id': bus.id,
                'bus_number': bus.bus_number,
                'bus_name': bus.bus_name,
                'voltage': bus.base_kv,
                'load_mw': round(total_load_mw, 2),
                'gen_mw': round(total_gen_mw, 2),
                'branch_count': branch_count,
                'is_isolated': branch_count == 0
            })
            
        # Format Response
        missing_mnemonics = []
        for mnemonic, buses in grouped.items():
            missing_mnemonics.append({
                'mnemonic': mnemonic,
                'bus_count': len(buses),
                'total_load_mw': sum(b['load_mw'] for b in buses),
                'buses': sorted(buses, key=lambda x: x['bus_name'])
            })
            
        missing_mnemonics.sort(key=lambda x: x['bus_count'], reverse=True)
        
        return Response({
            'snapshot_id': str(snapshot.id),
            'snapshot_name': snapshot.name,
            'has_missing': len(missing_mnemonics) > 0,
            'missing_count': len(missing_mnemonics),
            'missing_mnemonics': missing_mnemonics
        })

    def _get_snapshot(self, request, snapshot_id=None):
        """Helper to get snapshot with user isolation"""
        from core.models import NetworkSnapshot
        from django.db.models import Q
        
        # Base query: Created by user OR Public (null)
        if request.user.is_authenticated:
            qs = NetworkSnapshot.objects.filter(
                Q(created_by=request.user) | Q(created_by__isnull=True)
            )
        else:
            qs = NetworkSnapshot.objects.filter(created_by__isnull=True)
            
        if snapshot_id:
            try:
                return qs.get(id=snapshot_id)
            except NetworkSnapshot.DoesNotExist:
                return None
        active = qs.filter(is_active=True).order_by('-activated_at').first()
        return active or qs.last()
