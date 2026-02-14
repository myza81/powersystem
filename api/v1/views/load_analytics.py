from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count
from core.models import NetworkSnapshot, NetworkLoad


class LoadAnalyticsViewSet(viewsets.ViewSet):
    """
    V2 Load Analytics API
    Provides aggregated load data from NetworkLoad model
    """
    
    @action(detail=False, methods=['get'])
    def aggregate(self, request):
        """
        GET /api/v1/load-analytics/aggregate/
        
        Substation-centric aggregation using NetworkLoad → NetworkBus → Substation chain.
        
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
        
        # Get snapshot
        if snapshot_id:
            try:
                snapshot = NetworkSnapshot.objects.get(id=snapshot_id)
            except NetworkSnapshot.DoesNotExist:
                return Response({'error': 'Snapshot not found'}, status=404)
        else:
            snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        
        if not snapshot:
            return Response({'error': 'No snapshots found'}, status=404)
        
        # Get all loads and linked loads
        all_loads = snapshot.loads.all()
        linked_loads = snapshot.loads.filter(bus__substation__isnull=False)
        unlinked_loads = snapshot.loads.filter(bus__substation__isnull=True)
        
        # Calculate overall grid totals (including unlinked)
        overall_totals = all_loads.aggregate(
            total_pload_mw=Sum('p_mw'),
            total_qload_mvar=Sum('q_mvar'),
            load_count=Count('id')
        )
        
        # Count unique substations with loads
        substation_count = (
            Substation.objects
            .filter(snapshot_buses__snapshot=snapshot, snapshot_buses__loads__isnull=False)
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
                        snapshot_buses__snapshot=snapshot,
                        snapshot_buses__loads__isnull=False,
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
                        snapshot_buses__snapshot=snapshot,
                        snapshot_buses__loads__isnull=False,
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
                        snapshot_buses__snapshot=snapshot,
                        snapshot_buses__loads__isnull=False,
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

    
    @action(detail=False, methods=['get'])
    def missing_substations(self, request):
        """
        GET /api/v1/load-analytics/missing-substations/
        
        Returns unmatched mnemonics (buses that couldn't be linked to substations)
        for frontend notification alerts.
        
        Query params:
        - snapshot_id: UUID of snapshot (optional, uses latest if not provided)
        
        Returns:
        {
            "snapshot_id": "uuid",
            "snapshot_name": "Feb 2026 Test",
            "has_missing": true,
            "missing_count": 5,
            "missing_mnemonics": [
                {
                    "mnemonic": "NURG",
                    "bus_count": 2,
                    "buses": [
                        {"bus_number": 1960, "bus_name": "NURG132", "voltage": 132.0},
                        {"bus_number": 1961, "bus_name": "NURG275", "voltage": 275.0}
                    ]
                },
                ...
            ]
        }
        """
        snapshot_id = request.query_params.get('snapshot_id')
        
        # Get snapshot
        if snapshot_id:
            try:
                snapshot = NetworkSnapshot.objects.get(id=snapshot_id)
            except NetworkSnapshot.DoesNotExist:
                return Response({'error': 'Snapshot not found'}, status=404)
        else:
            snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
        
        if not snapshot:
            return Response({'error': 'No snapshots found'}, status=404)
        
        # Get unmatched mnemonics from snapshot metadata
        unmatched_data = snapshot.metadata.get('unmatched_mnemonics', {}) if snapshot.metadata else {}
        
        # Format for frontend
        missing_mnemonics = []
        for mnemonic, buses_list in unmatched_data.items():
            missing_mnemonics.append({
                'mnemonic': mnemonic,
                'bus_count': len(buses_list),
                'buses': buses_list
            })
        
        # Sort by bus count (descending)
        missing_mnemonics.sort(key=lambda x: x['bus_count'], reverse=True)
        
        return Response({
            'snapshot_id': str(snapshot.id),
            'snapshot_name': snapshot.name,
            'has_missing': len(missing_mnemonics) > 0,
            'missing_count': len(missing_mnemonics),
            'missing_mnemonics': missing_mnemonics
        })
