"""
Island Detection API Serializers

Serializers for island detection and critical bay analysis endpoints
"""

from rest_framework import serializers


class IslandSimulationSerializer(serializers.Serializer):
    """Serializer for island simulation request"""
    bay_id = serializers.CharField(
        required=True,
        help_text="Bay ID to simulate tripping (e.g., 'ADAM132_SRDN1')"
    )
    main_grid_substation = serializers.CharField(
        required=False,
        default='SRDN132',
        help_text="Main grid connection point (default: SRDN132)"
    )


class SubstationLoadSerializer(serializers.Serializer):
    """Serializer for substation load details"""
    substation_id = serializers.CharField()
    name = serializers.CharField()
    load_mw = serializers.FloatField()
    load_mvar = serializers.FloatField()


class IslandResultSerializer(serializers.Serializer):
    """Serializer for island detection result"""
    tripped_bay = serializers.CharField()
    from_substation = serializers.CharField()
    to_substation = serializers.CharField()
    isolated_substations = serializers.ListField(child=serializers.CharField())
    isolated_count = serializers.IntegerField()
    still_connected = serializers.ListField(child=serializers.CharField())
    still_connected_count = serializers.IntegerField()
    isolated_load_mw = serializers.FloatField()
    isolated_load_mvar = serializers.FloatField()
    is_critical = serializers.BooleanField()
    load_details = SubstationLoadSerializer(many=True, required=False)


class CriticalBaySerializer(serializers.Serializer):
    """Serializer for critical bay details"""
    bay_id = serializers.CharField()
    from_substation = serializers.CharField()
    to_substation = serializers.CharField()
    isolated_count = serializers.IntegerField()
    isolated_substations = serializers.ListField(child=serializers.CharField())
    isolated_load_mw = serializers.FloatField()
    isolated_load_mvar = serializers.FloatField()
    severity = serializers.FloatField()


class NetworkHubSerializer(serializers.Serializer):
    """Serializer for network hub details"""
    substation_id = serializers.CharField()
    connection_count = serializers.IntegerField()


class NetworkStatisticsSerializer(serializers.Serializer):
    """Serializer for network statistics"""
    total_substations = serializers.IntegerField()
    total_connections = serializers.IntegerField()
    avg_connections_per_substation = serializers.FloatField()
    top_hubs = NetworkHubSerializer(many=True)
