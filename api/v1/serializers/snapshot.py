from rest_framework import serializers  # type: ignore
from core.models import NetworkSnapshot  # type: ignore

class SnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkSnapshot
        fields = ['id', 'name', 'description', 'timestamp', 'base_mva', 'frequency', 'source_file']
        read_only_fields = ['id', 'timestamp', 'base_mva', 'frequency']
