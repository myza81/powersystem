from rest_framework import serializers
from core.models import (
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingStageSetting,
    LoadSheddingTransformerBay,
    LoadSheddingPocketBay,
    LoadSheddingPocketBoundary,
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

    def validate(self, data):
        version = data.get('version') or (self.instance.version if self.instance else None)
        new_settings = data.get('settings', [])
        
        if version:
            # Check for duplicate settings set in this version
            new_set = set(s.id for s in new_settings)
            existing_stages = LoadSheddingStage.objects.filter(version=version)
            if self.instance:
                existing_stages = existing_stages.exclude(id=self.instance.id)
            
            for stage in existing_stages:
                existing_set = set(stage.settings.values_list('id', flat=True))
                if existing_set == new_set and new_set: # Only block if non-empty (EMLS is handled separately)
                    raise serializers.ValidationError({"setting_ids": "A stage with this exact combination of settings already exists in this version."})
        
        return data
    def create(self, validated_data):
        setting_objects = validated_data.pop('settings', [])
        stage = LoadSheddingStage.objects.create(**validated_data)
        
        for setting in setting_objects:
            LoadSheddingStageSetting.objects.create(
                stage=stage,
                setting=setting,
                version=stage.version
            )
        return stage

    def update(self, instance, validated_data):
        setting_objects = validated_data.pop('settings', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if setting_objects is not None:
            LoadSheddingStageSetting.objects.filter(stage=instance).delete()
            for setting in setting_objects:
                LoadSheddingStageSetting.objects.create(
                    stage=instance,
                    setting=setting,
                    version=instance.version
                )
        return instance

    def validate(self, attrs):
        if self.instance is None:
            setting_ids = attrs.get('settings')
            if not setting_ids:
                pass
        return attrs


class LoadSheddingPocketBoundarySerializer(serializers.ModelSerializer):
    relay_substation_id = serializers.CharField(source='relay.substation.substation_id', read_only=True)
    relay_substation_name = serializers.CharField(source='relay.substation.name', read_only=True)
    relay_name = serializers.CharField(source='relay.relay_name', read_only=True)

    class Meta:
        model = LoadSheddingPocketBoundary
        fields = ['id', 'pocket', 'relay', 'relay_substation_id', 'relay_substation_name', 'relay_name', 'branches']


class LoadSheddingPocketBaySerializer(serializers.ModelSerializer):
    boundaries = LoadSheddingPocketBoundarySerializer(many=True, read_only=True)

    class Meta:
        model = LoadSheddingPocketBay
        fields = [
            'id', 'stage', 'boundaries', 'topology_cache', 
            'topology_valid', 'topology_alert'
        ]
        read_only_fields = ['topology_cache', 'topology_valid', 'topology_alert']


class LoadSheddingTransformerBaySerializer(serializers.ModelSerializer):
    relay_substation_id = serializers.CharField(source='relay.substation.substation_id', read_only=True)
    relay_substation_name = serializers.CharField(source='relay.substation.name', read_only=True)
    relay_name = serializers.CharField(source='relay.relay_name', read_only=True)

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
        fields = ['id', 'stage', 'relay', 'relay_substation_id', 'relay_substation_name', 'relay_name', 'transformers', 'mw_cache']
        read_only_fields = ['mw_cache']


class LoadSheddingStageDetailSerializer(LoadSheddingStageSerializer):
    transformer_bays = LoadSheddingTransformerBaySerializer(many=True, read_only=True)
    pocket_bays = LoadSheddingPocketBaySerializer(many=True, read_only=True)

    class Meta(LoadSheddingStageSerializer.Meta):
        fields = LoadSheddingStageSerializer.Meta.fields + ['transformer_bays', 'pocket_bays']


class LoadSheddingVersionSerializer(serializers.ModelSerializer):
    stages = LoadSheddingStageSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = LoadSheddingVersion
        fields = [
            'id', 'scheme_type', 'review_year', 'version', 'status', 'is_active',
            'published_at', 'published_by', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'notes',
            'stages',
        ]
        read_only_fields = ['version', 'published_at', 'published_by', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        if self.instance:
            # Check for immutable fields after creation
            for field in ['scheme_type', 'review_year', 'notes']:
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    raise serializers.ValidationError({
                        field: f"The {field.replace('_', ' ')} cannot be changed once a version is created to maintain data integrity."
                    })
        return attrs

    def create(self, validated_data):
        # Optional: ensure user is set if not provided (though get_queryset usually handles permissions)
        if 'request' in self.context and self.context['request'].user:
            validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


