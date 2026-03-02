from rest_framework import serializers
from core.models import (
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingSetting,
    LoadSheddingTransformerBay,
    LoadSheddingSpurBay,
    LoadSheddingPocketBay,
    NetworkSnapshot
)

class LoadSheddingSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadSheddingSetting
        fields = ['id', 'stage', 'order', 'threshold', 'time_delay']

class LoadSheddingTransformerBaySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadSheddingTransformerBay
        fields = ['id', 'stage', 'relay', 'transformers', 'mw_cache']
        read_only_fields = ['mw_cache']

class LoadSheddingSpurBaySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadSheddingSpurBay
        fields = ['id', 'stage', 'relay', 'branches', 'topology_cache']
        read_only_fields = ['topology_cache']

class LoadSheddingPocketBaySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadSheddingPocketBay
        fields = ['id', 'stage', 'boundary_relays', 'boundary_branches', 'topology_cache', 'topology_valid', 'topology_alert']
        read_only_fields = ['topology_cache', 'topology_valid', 'topology_alert']

class LoadSheddingStageSerializer(serializers.ModelSerializer):
    settings = LoadSheddingSettingSerializer(many=True, read_only=True)
    transformer_bays = LoadSheddingTransformerBaySerializer(many=True, read_only=True)
    spur_bays = LoadSheddingSpurBaySerializer(many=True, read_only=True)
    pocket_bays = LoadSheddingPocketBaySerializer(many=True, read_only=True)
    total_mw_estimate = serializers.FloatField(read_only=True)

    class Meta:
        model = LoadSheddingStage
        fields = [
            'id', 'version', 'stage_number', 'label', 
            'settings', 'transformer_bays', 'spur_bays', 'pocket_bays', 
            'total_mw_estimate'
        ]

class LoadSheddingVersionSerializer(serializers.ModelSerializer):
    stages = LoadSheddingStageSerializer(many=True, read_only=True)
    published_by_name = serializers.CharField(source='published_by.username', read_only=True)

    class Meta:
        model = LoadSheddingVersion
        fields = [
            'id', 'scheme_type', 'version_label', 'status', 'is_active', 
            'published_at', 'published_by', 'published_by_name', 
            'created_at', 'updated_at', 'notes', 'stages'
        ]
        read_only_fields = ['published_at', 'published_by', 'created_at', 'updated_at']
