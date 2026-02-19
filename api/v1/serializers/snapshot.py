from rest_framework import serializers  # type: ignore
from core.models import NetworkSnapshot  # type: ignore

class SnapshotSerializer(serializers.ModelSerializer):
    size_bytes = serializers.SerializerMethodField()

    class Meta:
        model = NetworkSnapshot
        fields = [
            'id', 'name', 'description', 'timestamp', 'base_mva', 'frequency',
            'source_file', 'is_active', 'activated_at', 'size_bytes'
        ]
        read_only_fields = ['id', 'timestamp', 'base_mva', 'frequency', 'activated_at', 'size_bytes']

    def get_size_bytes(self, obj):
        if obj.source_file:
            try:
                return obj.source_file.size
            except FileNotFoundError:
                return 0
        return 0
