"""
Serializers for Network Topology API
"""

from rest_framework import serializers
from core.models import IncomingBay, Substation


class SubstationMinimalSerializer(serializers.ModelSerializer):
    """Minimal substation info for topology responses"""
    class Meta:
        model = Substation
        fields = ['substation_id', 'mnemonic', 'name', 'voltage']


class IncomingBayTopologySerializer(serializers.ModelSerializer):
    """Serializer for incoming bay with topology info"""
    substation = SubstationMinimalSerializer(read_only=True)
    connected_to_substation = SubstationMinimalSerializer(read_only=True)
    tee_off_connections = SubstationMinimalSerializer(many=True, read_only=True)
    connection_summary = serializers.CharField(read_only=True)
    requires_validation = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = IncomingBay
        fields = [
            'bay_id',
            'bay_name',
            'substation',
            'connection_type',
            'connected_to_substation',
            'tee_off_connections',
            'validation_status',
            'auto_detected',
            'detection_confidence',
            'detection_note',
            'connection_summary',
            'requires_validation',
            'topology_changed',
            'validated_by',
            'validated_at',
        ]


class TopologyValidationSerializer(serializers.Serializer):
    """Serializer for validating a single connection"""
    bay_id = serializers.CharField(required=True)
    action = serializers.ChoiceField(
        choices=['approve', 'reject', 'modify'],
        required=True
    )
    connected_to_substation_id = serializers.CharField(required=False, allow_null=True)
    tee_off_substation_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    connection_type = serializers.ChoiceField(
        choices=['STANDARD', 'TEE_OFF', 'AUTOTRANSFORMER', 'EQUIPMENT', 'UNKNOWN'],
        required=False
    )
    note = serializers.CharField(required=False, allow_blank=True)


class BulkValidationSerializer(serializers.Serializer):
    """Serializer for bulk validation"""
    bay_ids = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        min_length=1
    )
    action = serializers.ChoiceField(
        choices=['approve', 'reject'],
        required=True
    )
