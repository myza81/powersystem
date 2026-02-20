from rest_framework import serializers
from core.models import (
    ProtectionRelay,
    LoadSheddingScheme,
    SchemeVersion,
    ShedGroupSetting,
    ShedGroupAssignment,
    Substation,
)


# ──────────────────────────────────────────────────────────────────
# Protection Relay Registry
# ──────────────────────────────────────────────────────────────────

class ProtectionRelaySerializer(serializers.ModelSerializer):
    substation_id_str = serializers.CharField(source='substation.substation_id', read_only=True)
    substation_name = serializers.CharField(source='substation.name', read_only=True)

    class Meta:
        model = ProtectionRelay
        fields = [
            'id', 'relay_type', 'relay_panel_id', 'substation',
            'substation_id_str', 'substation_name',
            'assignment_type', 'from_substation_id', 'to_substation_id',
            'circuit_id', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'substation_id_str', 'substation_name', 'created_at', 'updated_at']


# ──────────────────────────────────────────────────────────────────
# Load Shedding Schemes
# ──────────────────────────────────────────────────────────────────

class ShedGroupAssignmentSerializer(serializers.ModelSerializer):
    substation_name = serializers.CharField(
        source='substation.name', read_only=True, allow_null=True
    )
    substation_region = serializers.CharField(
        source='substation.region', read_only=True, allow_null=True
    )

    class Meta:
        model = ShedGroupAssignment
        fields = [
            'id', 'group', 'assignment_type',
            'from_substation_id', 'to_substation_id', 'circuit_id',
            'substation', 'substation_name', 'substation_region',
            'note',
        ]
        read_only_fields = ['id', 'substation', 'substation_name', 'substation_region']

    def validate(self, data):
        atype = data.get('assignment_type')
        to_sub = data.get('to_substation_id')
        if atype == 'branch' and not to_sub:
            raise serializers.ValidationError(
                {"to_substation_id": "Required for branch assignments."}
            )
        return data


class ShedGroupSettingSerializer(serializers.ModelSerializer):
    assignments = ShedGroupAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = ShedGroupSetting
        fields = [
            'id', 'version', 'name', 'operating_stage',
            'trigger_setpoint1', 'trigger_delay1',
            'trigger_setpoint2', 'trigger_delay2',
            'target_mw_shed', 'include_autotransformers',
            'assignments',
        ]
        read_only_fields = ['id', 'assignments']


class ShedGroupSettingWriteSerializer(serializers.ModelSerializer):
    """Write-only — no nested assignments."""
    class Meta:
        model = ShedGroupSetting
        fields = [
            'id', 'version', 'name', 'operating_stage',
            'trigger_setpoint1', 'trigger_delay1',
            'trigger_setpoint2', 'trigger_delay2',
            'target_mw_shed', 'include_autotransformers',
        ]
        read_only_fields = ['id']


class SchemeVersionSerializer(serializers.ModelSerializer):
    """
    Read: includes nested groups + assignments (full analytical payload).
    """
    groups = ShedGroupSettingSerializer(many=True, read_only=True)
    scheme_type = serializers.CharField(source='scheme.scheme_type', read_only=True)
    published_by_username = serializers.CharField(
        source='published_by.username', read_only=True, allow_null=True
    )

    class Meta:
        model = SchemeVersion
        fields = [
            'id', 'scheme', 'scheme_type', 'version_number', 'status',
            'effective_date', 'published_by', 'published_by_username',
            'published_at', 'notes', 'groups', 'created_at',
        ]
        read_only_fields = [
            'id', 'scheme_type', 'published_by', 'published_by_username',
            'published_at', 'groups', 'created_at',
        ]


class SchemeVersionListSerializer(serializers.ModelSerializer):
    """Lightweight — no nested groups."""
    scheme_type = serializers.CharField(source='scheme.scheme_type', read_only=True)
    published_by_username = serializers.CharField(
        source='published_by.username', read_only=True, allow_null=True
    )

    class Meta:
        model = SchemeVersion
        fields = [
            'id', 'scheme', 'scheme_type', 'version_number', 'status',
            'effective_date', 'published_by', 'published_by_username',
            'published_at', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'scheme_type', 'published_by_username', 'published_at', 'created_at']


class LoadSheddingSchemeSerializer(serializers.ModelSerializer):
    versions = SchemeVersionListSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(
        source='created_by.username', read_only=True, allow_null=True
    )

    class Meta:
        model = LoadSheddingScheme
        fields = [
            'id', 'scheme_type', 'name', 'description',
            'created_by', 'created_by_username', 'created_at', 'updated_at',
            'versions',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_username', 'created_at', 'updated_at', 'versions']
