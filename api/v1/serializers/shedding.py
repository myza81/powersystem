from rest_framework import serializers
from core.models import (
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingStageSetting,
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


class LoadSheddingVersionSerializer(serializers.ModelSerializer):
    stages = LoadSheddingStageSerializer(many=True, read_only=True)

    class Meta:
        model = LoadSheddingVersion
        fields = ['id', 'scheme_type', 'version_label', 'stages']
