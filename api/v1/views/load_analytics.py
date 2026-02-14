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
        
        Query params:
        - snapshot_id: UUID of snapshot (optional, uses latest if not provided)
        - level: 'grid' | 'region' | 'state' | 'ownership' (currently returns all)
        
        Returns:
        {
            "snapshot_id": "uuid",
            "snapshot_name": "Feb 2026 Test",
            "timestamp": "2026-02-12T15:06:00Z",
            "total_pload_mw": 28208.17,
            "total_qload_mvar": 5682.47,
            "load_count": 1971,
            "regional_breakdown": [...],
            "state_breakdown": [...],
            "ownership_breakdown": [...],
            "coverage": {
                "total_loads": 1971,
                "loads_with_substations": 1546,
                "coverage_percent": 78.4
            }
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
        
        # Get loads for this snapshot
        loads = snapshot.loads.select_related(
            'bus__substation',
            'bus__psse_area',
            'bus__psse_zone',
            'bus__psse_owner'
        )
        
        # Calculate grid totals
        grid_totals = loads.aggregate(
            total_pload_mw=Sum('p_mw'),
            total_qload_mvar=Sum('q_mvar'),
            load_count=Count('id')
        )
        
        # Regional breakdown (using substation.region)
        loads_with_subs = loads.filter(bus__substation__isnull=False)
        regional_breakdown = []
        
        for region in ['North', 'Central', 'South', 'East']:
            region_loads = loads_with_subs.filter(bus__substation__region=region)
            region_data = region_loads.aggregate(
                total_pload_mw=Sum('p_mw'),
                total_qload_mvar=Sum('q_mvar'),
                load_count=Count('id')
            )
            if region_data['total_pload_mw']:
                regional_breakdown.append({
                    'region': region,
                    'total_pload_mw': round(region_data['total_pload_mw'], 2),
                    'total_qload_mvar': round(region_data['total_qload_mvar'], 2),
                    'load_count': region_data['load_count']
                })
        
        # State breakdown (using substation.state)
        state_breakdown = []
        states = loads_with_subs.values_list('bus__substation__state', flat=True).distinct()
        
        for state in states:
            if not state or not state.strip():
                continue
            state_loads = loads_with_subs.filter(bus__substation__state=state)
            state_data = state_loads.aggregate(
                total_pload_mw=Sum('p_mw'),
                total_qload_mvar=Sum('q_mvar'),
                load_count=Count('id')
            )
            if state_data['total_pload_mw']:
                state_breakdown.append({
                    'state': state.strip(),
                    'total_pload_mw': round(state_data['total_pload_mw'], 2),
                    'total_qload_mvar': round(state_data['total_qload_mvar'], 2),
                    'load_count': state_data['load_count']
                })
        
        # Ownership breakdown (using substation.ownership)
        ownership_breakdown = []
        ownerships = loads_with_subs.values_list('bus__substation__ownership', flat=True).distinct()
        
        for ownership in ownerships:
            if not ownership or not ownership.strip():
                continue
            ownership_loads = loads_with_subs.filter(bus__substation__ownership=ownership)
            ownership_data = ownership_loads.aggregate(
                total_pload_mw=Sum('p_mw'),
                total_qload_mvar=Sum('q_mvar'),
                load_count=Count('id')
            )
            if ownership_data['total_pload_mw']:
                ownership_breakdown.append({
                    'ownership': ownership.strip(),
                    'total_pload_mw': round(ownership_data['total_pload_mw'], 2),
                    'total_qload_mvar': round(ownership_data['total_qload_mvar'], 2),
                    'load_count': ownership_data['load_count']
                })
        
        return Response({
            'snapshot_id': str(snapshot.id),
            'snapshot_name': snapshot.name,
            'timestamp': snapshot.timestamp,
            'total_pload_mw': round(grid_totals['total_pload_mw'] or 0, 2),
            'total_qload_mvar': round(grid_totals['total_qload_mvar'] or 0, 2),
            'load_count': grid_totals['load_count'],
            'regional_breakdown': regional_breakdown,
            'state_breakdown': state_breakdown,
            'ownership_breakdown': ownership_breakdown,
            'coverage': {
                'total_loads': loads.count(),
                'loads_with_substations': loads_with_subs.count(),
                'coverage_percent': round(loads_with_subs.count() / loads.count() * 100, 1) if loads.count() > 0 else 0
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
