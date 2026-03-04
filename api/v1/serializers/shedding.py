from rest_framework import serializers
from core.models import (
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingStageSetting,
    LoadSheddingTransformerBay,
    NetworkSnapshot
)

class LoadSheddingSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadSheddingSetting
        fields = ['id', 'scheme_type', 'threshold', 'time_delay', 'label']
        read_only_fields = ['label']


class LoadSheddingStageSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadSheddingStageSetting
        fields = ['id', 'stage', 'setting', 'version']


class LoadSheddingStageSerializer(serializers.ModelSerializer):
    settings = LoadSheddingSettingSerializer(many=True, read_only=True)
    setting_ids = serializers.PrimaryKeyRelatedField(
        source='settings',
        many=True,
        queryset=LoadSheddingSetting.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = LoadSheddingStage
        fields = ['id', 'version', 'stage_number', 'label', 'settings', 'setting_ids']

    def validate(self, attrs):
        if self.instance is None:
            setting_ids = attrs.get('settings')
            if not setting_ids:
                raise serializers.ValidationError({"setting_ids": "At least one setting is required."})
        return attrs


class LoadSheddingVersionSerializer(serializers.ModelSerializer):
    stages = LoadSheddingStageSerializer(many=True, read_only=True)

    class Meta:
        model = LoadSheddingVersion
        fields = [
            'id', 'scheme_type', 'version_label', 'status', 'is_active',
            'published_at', 'published_by', 'created_at', 'updated_at', 'notes',
            'stages',
        ]
        read_only_fields = ['published_at', 'published_by', 'created_at', 'updated_at']


class LoadSheddingTransformerBaySerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        relay = attrs.get('relay') or getattr(self.instance, 'relay', None)
        transformers = attrs.get('transformers')
        if relay is not None and transformers is not None:
            allowed_ids = set(relay.load_transformers.values_list('id', flat=True))
            selected_ids = {t.id for t in transformers}
            if not selected_ids.issubset(allowed_ids):
                raise serializers.ValidationError({
                    "transformers": "Selected transformers must belong to the relay's load transformers."
                })
        return attrs

    class Meta:
        model = LoadSheddingTransformerBay
        fields = ['id', 'stage', 'relay', 'transformers', 'mw_cache']
        read_only_fields = ['mw_cache']
