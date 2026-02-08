"""
Network Topology API Views

API endpoints for network topology validation workflow
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db.models import Q

from core.models import IncomingBay, Substation
from services.network_topology import NetworkTopologyService
from api.v1.serializers.network_topology import (
    IncomingBayTopologySerializer,
    TopologyValidationSerializer,
    BulkValidationSerializer,
)


class NetworkTopologyViewSet(viewsets.ViewSet):
    """
    ViewSet for network topology detection and validation
    """
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def pending_validations(self, request):
        """
        Get all bays that require user validation
        
        Query params:
            - limit: Max results (default: 50)
            - offset: Pagination offset
            - confidence_min: Minimum confidence filter
            - confidence_max: Maximum confidence filter
            - connection_type: Filter by type
        """
        # Get query params
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        confidence_min = request.query_params.get('confidence_min')
        confidence_max = request.query_params.get('confidence_max')
        connection_type = request.query_params.get('connection_type')
        include_all = request.query_params.get('include_all', 'false').lower() == 'true'
        
        # Base query
        if include_all:
             queryset = IncomingBay.objects.all()
        else:
            queryset = IncomingBay.objects.filter(
                Q(validation_status='PENDING') | Q(validation_status='REJECTED') | Q(topology_changed=True)
            )
            
        queryset = queryset.select_related('substation', 'connected_to_substation').prefetch_related('tee_off_connections')
        
        # Apply filters
        if confidence_min:
            queryset = queryset.filter(detection_confidence__gte=float(confidence_min))
        if confidence_max:
            queryset = queryset.filter(detection_confidence__lte=float(confidence_max))
        if connection_type:
            queryset = queryset.filter(connection_type=connection_type)
        
        # Order by confidence (lowest first - most urgent)
        queryset = queryset.order_by('detection_confidence', 'bay_id')
        
        # Pagination
        total = queryset.count()
        bays = queryset[offset:offset + limit]
        
        # Serialize
        serializer = IncomingBayTopologySerializer(bays, many=True)
        
        return Response({
            'total': total,
            'limit': limit,
            'offset': offset,
            'results': serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def validate_connection(self, request):
        """
        Validate a single connection
        
        Body:
            {
                "bay_id": "ADAM132_SRDN1",
                "action": "approve" | "reject" | "modify",
                "connected_to_substation_id": "SRDN132" (optional, for modify),
                "tee_off_substation_ids": ["NRWG132", "HKCK132"] (optional, for modify),
                "connection_type": "STANDARD" | "TEE_OFF" (optional, for modify),
                "note": "User comment" (optional)
            }
        """
        serializer = TopologyValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        bay_id = serializer.validated_data['bay_id']
        action_type = serializer.validated_data['action']
        
        try:
            bay = IncomingBay.objects.get(bay_id=bay_id)
        except IncomingBay.DoesNotExist:
            return Response(
                {'error': f'Bay {bay_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Handle different actions
        if action_type == 'approve':
            # Approve auto-detected connection
            bay.validation_status = 'VALIDATED'
            bay.validated_by = request.user
            bay.validated_at = timezone.now()
            bay.topology_changed = False
            
            if serializer.validated_data.get('note'):
                bay.detection_note += f"\nUser note: {serializer.validated_data['note']}"
            
            bay.save()
            
            return Response({
                'status': 'approved',
                'bay_id': bay.bay_id,
                'connection': bay.connection_summary
            })
        
        elif action_type == 'reject':
            # Reject detection, mark for manual review
            bay.validation_status = 'REJECTED'
            bay.validated_by = request.user
            bay.validated_at = timezone.now()
            bay.topology_changed = False
            
            if serializer.validated_data.get('note'):
                bay.detection_note = f"Rejected: {serializer.validated_data['note']}"
            
            bay.save()
            
            return Response({
                'status': 'rejected',
                'bay_id': bay.bay_id
            })
        
        elif action_type == 'modify':
            # User manually specifies connection
            connected_to_id = serializer.validated_data.get('connected_to_substation_id')
            tee_off_ids = serializer.validated_data.get('tee_off_substation_ids', [])
            conn_type = serializer.validated_data.get('connection_type', 'STANDARD')
            
            # Validate substation exists
            if connected_to_id:
                try:
                    connected_to = Substation.objects.get(substation_id=connected_to_id)
                    bay.connected_to_substation = connected_to
                except Substation.DoesNotExist:
                    return Response(
                        {'error': f'Substation {connected_to_id} not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Handle tee-offs
            if tee_off_ids:
                tee_off_substations = Substation.objects.filter(substation_id__in=tee_off_ids)
                if tee_off_substations.count() != len(tee_off_ids):
                    return Response(
                        {'error': 'One or more tee-off substations not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                bay.tee_off_connections.set(tee_off_substations)
            
            bay.connection_type = conn_type
            bay.validation_status = 'VALIDATED'
            bay.validated_by = request.user
            bay.validated_at = timezone.now()
            bay.topology_changed = False
            bay.auto_detected = False  # User manually set
            bay.detection_confidence = 1.0  # User override
            
            if serializer.validated_data.get('note'):
                bay.detection_note = f"User modified: {serializer.validated_data['note']}"
            
            bay.save()
            
            return Response({
                'status': 'modified',
                'bay_id': bay.bay_id,
                'connection': bay.connection_summary
            })
    
    @action(detail=False, methods=['post'])
    def bulk_validate(self, request):
        """
        Bulk validate multiple connections
        
        Body:
            {
                "bay_ids": ["ADAM132_SRDN1", "ADAM132_SDCA1", ...],
                "action": "approve" | "reject"
            }
        """
        serializer = BulkValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        bay_ids = serializer.validated_data['bay_ids']
        action_type = serializer.validated_data['action']
        
        bays = IncomingBay.objects.filter(bay_id__in=bay_ids)
        
        if bays.count() != len(bay_ids):
            return Response(
                {'error': 'One or more bays not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Apply action to all bays
        updated = 0
        for bay in bays:
            if action_type == 'approve':
                bay.validation_status = 'VALIDATED'
            elif action_type == 'reject':
                bay.validation_status = 'REJECTED'
            
            bay.validated_by = request.user
            bay.validated_at = timezone.now()
            bay.topology_changed = False
            bay.save()
            updated += 1
        
        return Response({
            'status': 'success',
            'action': action_type,
            'updated': updated
        })
    
    @action(detail=False, methods=['post'])
    def run_detection(self, request):
        """
        Run auto-detection on all pending bays
        
        Returns summary of detection results
        """
        results = NetworkTopologyService.auto_detect_all()
        
        return Response({
            'status': 'complete',
            'processed': results['processed'],
            'auto_validated': results['auto_validated'],
            'pending_review': results['pending_review'],
            'rejected': results['rejected'],
            'low_confidence_cases': len(results['details']),
            'details': results['details'][:20]  # First 20 cases
        })
    
    @action(detail=False, methods=['post'])
    def check_changes(self, request):
        """
        Check for topology changes in validated connections
        
        Returns list of changed connections
        """
        changes = NetworkTopologyService.check_topology_changes()
        
        return Response({
            'status': 'complete',
            'changes_detected': len(changes),
            'changes': changes
        })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Get topology validation statistics
        """
        total = IncomingBay.objects.count()
        auto_validated = IncomingBay.objects.filter(validation_status='AUTO_VALIDATED').count()
        user_validated = IncomingBay.objects.filter(validation_status='VALIDATED').count()
        pending = IncomingBay.objects.filter(validation_status='PENDING').count()
        rejected = IncomingBay.objects.filter(validation_status='REJECTED').count()
        changed = IncomingBay.objects.filter(topology_changed=True).count()
        
        # Connection type breakdown
        standard = IncomingBay.objects.filter(connection_type='STANDARD').count()
        tee_off = IncomingBay.objects.filter(connection_type='TEE_OFF').count()
        autotransformer = IncomingBay.objects.filter(connection_type='AUTOTRANSFORMER').count()
        equipment = IncomingBay.objects.filter(connection_type='EQUIPMENT').count()
        unknown = IncomingBay.objects.filter(connection_type='UNKNOWN').count()
        
        return Response({
            'total_bays': total,
            'validation_status': {
                'auto_validated': auto_validated,
                'user_validated': user_validated,
                'pending': pending,
                'rejected': rejected,
                'topology_changed': changed,
            },
            'connection_types': {
                'standard': standard,
                'tee_off': tee_off,
                'autotransformer': autotransformer,
                'equipment': equipment,
                'unknown': unknown,
            },
            'validation_rate': round((auto_validated + user_validated) / total * 100, 1) if total > 0 else 0
        })
