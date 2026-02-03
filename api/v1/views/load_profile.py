"""
Load Profile API Views

Endpoints for:
- Uploading load profile Excel files
- Retrieving aggregated load data
"""

import os
import tempfile
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum

from core.models import Substation, BayLoad
from services.load_profile_service import LoadProfileService


class LoadProfileViewSet(viewsets.ViewSet):
    """
    ViewSet for load profile operations.
    
    Endpoints:
    - POST /load-profiles/upload/ - Upload Excel file
    - GET /load-profiles/aggregate/ - Get aggregated load data
    """
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """
        Upload and process load profile Excel file.
        
        Request:
            - Method: POST
            - Content-Type: multipart/form-data
            - Body: file (Excel .xlsx or .xls)
        
        Response:
            {
                "total_rows": 150,
                "matched": 142,
                "unmatched": 8,
                "upload_batch_id": "uuid-string",
                "unmatched_details": [
                    {"mnemonic": "LGMR", "id": "F1", "reason": "Bay F1 not found..."},
                    ...
                ]
            }
        """
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file extension
        file_ext = file_obj.name.split('.')[-1].lower()
        if file_ext not in ['xlsx', 'xls']:
            return Response(
                {'error': 'Invalid file type. Only .xlsx and .xls files are supported.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp_file:
            for chunk in file_obj.chunks():
                tmp_file.write(chunk)
            tmp_path = tmp_file.name
        
        try:
            # Process upload
            results = LoadProfileService.process_upload(tmp_path)
            
            return Response(results, status=status.HTTP_200_OK)
        
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Upload processing failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    @action(detail=False, methods=['get'])
    def latest_upload(self, request):
        """
        Get statistics for the most recent upload batch.
        
        Returns:
            {
                "has_data": true/false,
                "total_rows": 1446,
                "matched": 12,
                "unmatched": 1434,
                "upload_batch_id": "uuid-string",
                "upload_timestamp": "2026-02-03T12:30:00Z",
                "unmatched_details": [...]
            }
        """
        # Get the most recent upload batch
        latest_load = BayLoad.objects.order_by('-upload_timestamp').first()
        
        if not latest_load:
            return Response({'has_data': False}, status=status.HTTP_200_OK)
        
        batch_id = latest_load.upload_batch_id
        
        # Get all records from this batch
        batch_records = BayLoad.objects.filter(upload_batch_id=batch_id)
        total_rows = batch_records.count()
        matched = batch_records.filter(matched=True).count()
        unmatched = batch_records.filter(matched=False).count()
        
        # Get unmatched details
        unmatched_records = batch_records.filter(matched=False)
        unmatched_details = []
        for record in unmatched_records[:50]:  # Limit to 50
            # Try to infer reason from missing relationships
            reason = "Unknown reason"
            if record.mnemonic and record.bay_identifier:
                # Check if substation exists
                from services.bay_id_matcher import BayIDMatcher
                bus_name = record.bus_name or ""
                voltage = BayIDMatcher.extract_voltage_from_bus_name(bus_name)
                if voltage:
                    substation_id = f"{record.mnemonic}{voltage}"
                    if not Substation.objects.filter(substation_id=substation_id).exists():
                        reason = f"Substation {substation_id} does not exist"
                    else:
                        reason = f"Bay {record.bay_identifier} not found in substation {substation_id}"
                else:
                    reason = f"Could not extract voltage from Bus Name: {bus_name}"
            
            unmatched_details.append({
                'mnemonic': record.mnemonic,
                'id': record.bay_identifier,
                'reason': reason
            })
        
        return Response({
            'has_data': True,
            'total_rows': total_rows,
            'matched': matched,
            'unmatched': unmatched,
            'upload_batch_id': str(batch_id),
            'upload_timestamp': latest_load.upload_timestamp.isoformat(),
            'unmatched_details': unmatched_details
        }, status=status.HTTP_200_OK)

    
    @action(detail=False, methods=['get'])
    def aggregate(self, request):
        """
        Get aggregated load data by level and key.
        
        Query Parameters:
            - level: 'grid' | 'region' | 'state' | 'substation'
            - key: Specific identifier (e.g., 'KEDP', 'North', 'Perlis', 'ABBA132')
        
        Response:
            {
                "level": "substation",
                "key": "ABBA132",
                "total_pload_mw": 245.5,
                "total_qload_mvar": 67.3,
                "breakdown": [
                    {"bay_id": "ABBA132_T1", "pload_mw": 120.0, "qload_mvar": 30.5},
                    {"bay_id": "ABBA132_F1", "pload_mw": 125.5, "qload_mvar": 36.8}
                ]
            }
        """
        level = request.query_params.get('level', 'grid')
        key = request.query_params.get('key')
        
        if level == 'grid':
            return self._aggregate_grid()
        elif level == 'region':
            return self._aggregate_region(key)
        elif level == 'state':
            return self._aggregate_state(key)
        elif level == 'substation':
            return self._aggregate_substation(key)
        else:
            return Response(
                {'error': 'Invalid level. Must be one of: grid, region, state, substation'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _aggregate_grid(self):
        """Aggregate total load across entire grid."""
        totals = BayLoad.objects.filter(matched=True).aggregate(
            total_pload=Sum('pload_mw'),
            total_qload=Sum('qload_mvar')
        )
        
        # Breakdown by region
        regions = Substation.objects.order_by().values('region').distinct()
        breakdown = []
        for region_data in regions:
            region = region_data['region']
            if not region:
                continue
            
            region_totals = BayLoad.objects.filter(
                matched=True,
                transformer__substation__region=region
            ).aggregate(
                total_pload=Sum('pload_mw'),
                total_qload=Sum('qload_mvar')
            )
            
            region_totals_bays = BayLoad.objects.filter(
                matched=True,
                incoming_bay__substation__region=region
            ).aggregate(
                total_pload=Sum('pload_mw'),
                total_qload=Sum('qload_mvar')
            )
            
            breakdown.append({
                'region': region,
                'total_pload_mw': (region_totals['total_pload'] or 0) + (region_totals_bays['total_pload'] or 0),
                'total_qload_mvar': (region_totals['total_qload'] or 0) + (region_totals_bays['total_qload'] or 0)
            })
        
        # Sort breakdown by region name
        breakdown.sort(key=lambda x: x['region'] or '')
        
        # Calculate ownership breakdown (DC, LPC, IPP, LSS, etc.)
        ownership_types = ['DC', 'LPC', 'IPP', 'LSS']
        ownership_breakdown = []
        
        for owner_type in ownership_types:
            totals_t = BayLoad.objects.filter(
                matched=True,
                transformer__substation__ownership=owner_type
            ).aggregate(
                total_pload=Sum('pload_mw'), 
                total_qload=Sum('qload_mvar')
            )
            
            totals_b = BayLoad.objects.filter(
                matched=True,
                incoming_bay__substation__ownership=owner_type
            ).aggregate(
                total_pload=Sum('pload_mw'), 
                total_qload=Sum('qload_mvar')
            )
            
            total_mw = (totals_t['total_pload'] or 0) + (totals_b['total_pload'] or 0)
            total_mvar = (totals_t['total_qload'] or 0) + (totals_b['total_qload'] or 0)
            
            if total_mw > 0 or total_mvar > 0:
                ownership_breakdown.append({
                    'type': owner_type,
                    'total_pload_mw': total_mw,
                    'total_qload_mvar': total_mvar
                })
        
        return Response({
            'level': 'grid',
            'total_pload_mw': totals['total_pload'] or 0,
            'total_qload_mvar': totals['total_qload'] or 0,
            'breakdown': breakdown,
            'ownership_breakdown': ownership_breakdown
        })
    
    def _aggregate_region(self, region):
        """Aggregate load for a specific region."""
        if not region:
            return Response({'error': 'Region key required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Totals for transformers
        totals_t = BayLoad.objects.filter(
            matched=True,
            transformer__substation__region=region
        ).aggregate(
            total_pload=Sum('pload_mw'),
            total_qload=Sum('qload_mvar')
        )
        
        # Totals for incoming bays
        totals_b = BayLoad.objects.filter(
            matched=True,
            incoming_bay__substation__region=region
        ).aggregate(
            total_pload=Sum('pload_mw'),
            total_qload=Sum('qload_mvar')
        )
        
        # Breakdown by state
        states = Substation.objects.filter(region=region).order_by().values('state').distinct()
        breakdown = []
        for state_data in states:
            state = state_data['state']
            if not state:
                continue
            
            state_t = BayLoad.objects.filter(
                matched=True,
                transformer__substation__state=state
            ).aggregate(total_pload=Sum('pload_mw'), total_qload=Sum('qload_mvar'))
            
            state_b = BayLoad.objects.filter(
                matched=True,
                incoming_bay__substation__state=state
            ).aggregate(total_pload=Sum('pload_mw'), total_qload=Sum('qload_mvar'))
            
            breakdown.append({
                'state': state,
                'total_pload_mw': (state_t['total_pload'] or 0) + (state_b['total_pload'] or 0),
                'total_qload_mvar': (state_t['total_qload'] or 0) + (state_b['total_qload'] or 0)
            })
        
        return Response({
            'level': 'region',
            'key': region,
            'total_pload_mw': (totals_t['total_pload'] or 0) + (totals_b['total_pload'] or 0),
            'total_qload_mvar': (totals_t['total_qload'] or 0) + (totals_b['total_qload'] or 0),
            'breakdown': breakdown
        })
    
    def _aggregate_state(self, state):
        """Aggregate load for a specific state."""
        if not state:
            return Response({'error': 'State key required'}, status=status.HTTP_400_BAD_REQUEST)
        
        totals_t = BayLoad.objects.filter(
            matched=True,
            transformer__substation__state=state
        ).aggregate(
            total_pload=Sum('pload_mw'),
            total_qload=Sum('qload_mvar')
        )
        
        totals_b = BayLoad.objects.filter(
            matched=True,
            incoming_bay__substation__state=state
        ).aggregate(
            total_pload=Sum('pload_mw'),
            total_qload=Sum('qload_mvar')
        )
        
        # Breakdown by substation
        substations = Substation.objects.filter(state=state)
        breakdown = []
        for sub in substations:
            breakdown.append({
                'substation_id': sub.substation_id,
                'name': sub.name,
                'total_pload_mw': sub.total_pload_mw,
                'total_qload_mvar': sub.total_qload_mvar
            })
        
        return Response({
            'level': 'state',
            'key': state,
            'total_pload_mw': (totals_t['total_pload'] or 0) + (totals_b['total_pload'] or 0),
            'total_qload_mvar': (totals_t['total_qload'] or 0) + (totals_b['total_qload'] or 0),
            'breakdown': breakdown
        })
    
    def _aggregate_substation(self, substation_id):
        """Aggregate load for a specific substation."""
        if not substation_id:
            return Response({'error': 'Substation ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            substation = Substation.objects.get(substation_id=substation_id)
        except Substation.DoesNotExist:
            return Response({'error': 'Substation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get breakdown by bay
        breakdown = []
        
        # Transformers
        for transformer in substation.transformers.all():
            if hasattr(transformer, 'load_data'):
                breakdown.append({
                    'bay_id': transformer.bay_id,
                    'bay_name': transformer.bay_name,
                    'type': 'transformer',
                    'pload_mw': transformer.load_data.pload_mw,
                    'qload_mvar': transformer.load_data.qload_mvar
                })
        
        # Incoming Bays
        for bay in substation.incoming_bays.all():
            if hasattr(bay, 'load_data'):
                breakdown.append({
                    'bay_id': bay.bay_id,
                    'bay_name': bay.bay_name,
                    'type': 'incoming_bay',
                    'pload_mw': bay.load_data.pload_mw,
                    'qload_mvar': bay.load_data.qload_mvar
                })
        
        return Response({
            'level': 'substation',
            'key': substation_id,
            'name': substation.name,
            'total_pload_mw': substation.total_pload_mw,
            'total_qload_mvar': substation.total_qload_mvar,
            'breakdown': breakdown
        })
