from rest_framework import serializers
from core.models import (
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingStageSetting,
    LoadSheddingTransformerBay,
    LoadSheddingPocketBay,
    LoadSheddingPocketBoundary,
    LoadSheddingAlertConfig,
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
    settings = serializers.SerializerMethodField()
    def get_settings(self, obj):
        ordered_stagesettings = obj.loadsheddingstagesetting_set.order_by('order').select_related('setting')
        settings = [ss.setting for ss in ordered_stagesettings]
        return LoadSheddingSettingSerializer(settings, many=True).data
    setting_ids = serializers.PrimaryKeyRelatedField(
        source='settings',
        many=True,
        queryset=LoadSheddingSetting.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = LoadSheddingStage
        fields = ['id', 'version', 'stage_number', 'label', 'target_mw', 'settings', 'setting_ids']

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
        
        for idx, setting in enumerate(setting_objects):
            LoadSheddingStageSetting.objects.create(
                stage=stage,
                setting=setting,
                version=stage.version,
                order=idx
            )
        return stage

    def update(self, instance, validated_data):
        setting_objects = validated_data.pop('settings', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if setting_objects is not None:
            LoadSheddingStageSetting.objects.filter(stage=instance).delete()
            for idx, setting in enumerate(setting_objects):
                LoadSheddingStageSetting.objects.create(
                    stage=instance,
                    setting=setting,
                    version=instance.version,
                    order=idx
                )
        return instance

    def validate(self, attrs):
        if self.instance is None:
            setting_ids = attrs.get('settings')
            if not setting_ids:
                pass
        return attrs


class LoadSheddingPocketBoundarySerializer(serializers.ModelSerializer):
    relay_substation_id = serializers.SerializerMethodField()
    relay_substation_name = serializers.SerializerMethodField()
    relay_name = serializers.SerializerMethodField()

    class Meta:
        model = LoadSheddingPocketBoundary
        fields = ['id', 'pocket', 'relay', 'relay_substation_id', 'relay_substation_name', 'relay_name', 'branches', 'frozen_assets']

    def get_relay_substation_id(self, obj):
        return obj.relay.substation.substation_id if obj.relay else obj.frozen_substation_id
        
    def get_relay_substation_name(self, obj):
        return obj.relay.substation.name if obj.relay else obj.frozen_substation_name
        
    def get_relay_name(self, obj):
        return obj.relay.relay_name if obj.relay else obj.frozen_relay_name

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._freeze_metadata(instance)
        instance.save(update_fields=['frozen_relay_name', 'frozen_substation_id', 'frozen_substation_name', 'frozen_assets'])
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._freeze_metadata(instance)
        instance.save(update_fields=['frozen_relay_name', 'frozen_substation_id', 'frozen_substation_name', 'frozen_assets'])
        return instance

    def _freeze_metadata(self, instance):
        if getattr(instance, 'relay', None):
            instance.frozen_relay_name = getattr(instance.relay, 'relay_name', '')
            sub = getattr(instance.relay, 'substation', None)
            if sub:
                instance.frozen_substation_id = getattr(sub, 'substation_id', '')
                instance.frozen_substation_name = getattr(sub, 'name', '')
                
        assets = []
        for b in instance.branches.all():
            assets.append({
                'from_sub': b.substation.substation_id if getattr(b, 'substation', None) else '',
                'to_sub': b.to_substation.substation_id if getattr(b, 'to_substation', None) else '',
                'ckt_id': getattr(b, 'ckt_id', '')
            })
        instance.frozen_assets = assets


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
    relay_substation_id = serializers.SerializerMethodField()
    relay_substation_name = serializers.SerializerMethodField()
    relay_name = serializers.SerializerMethodField()

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
        fields = ['id', 'stage', 'relay', 'relay_substation_id', 'relay_substation_name', 'relay_name', 'transformers', 'mw_cache', 'frozen_assets']
        read_only_fields = ['mw_cache']

    def get_relay_substation_id(self, obj):
        return obj.relay.substation.substation_id if obj.relay else obj.frozen_substation_id
        
    def get_relay_substation_name(self, obj):
        return obj.relay.substation.name if obj.relay else obj.frozen_substation_name
        
    def get_relay_name(self, obj):
        return obj.relay.relay_name if obj.relay else obj.frozen_relay_name

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._freeze_metadata(instance)
        instance.save(update_fields=['frozen_relay_name', 'frozen_substation_id', 'frozen_substation_name', 'frozen_assets'])
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._freeze_metadata(instance)
        instance.save(update_fields=['frozen_relay_name', 'frozen_substation_id', 'frozen_substation_name', 'frozen_assets'])
        return instance

    def _freeze_metadata(self, instance):
        if getattr(instance, 'relay', None):
            instance.frozen_relay_name = getattr(instance.relay, 'relay_name', '')
            sub = getattr(instance.relay, 'substation', None)
            if sub:
                instance.frozen_substation_id = getattr(sub, 'substation_id', '')
                instance.frozen_substation_name = getattr(sub, 'name', '')
                
        assets = []
        target_bay_ids = instance.transformers.values_list('bay_id', flat=True)
        for bid in target_bay_ids:
            parts = str(bid).split('_', 1)
            assets.append(parts[1] if len(parts) > 1 else bid)
        instance.frozen_assets = assets


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
            'id', 'scheme_type', 'review_year', 'version', 'target_percentage', 'status', 'is_active',
            'published_at', 'published_by', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'notes',
            'stages',
        ]
        read_only_fields = ['version', 'published_at', 'published_by', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        if self.instance:
            # Only protect core identity fields on published/deactivated versions.
            # Drafts (including newly cloned ones) are allowed to rename/reconfigure freely.
            if self.instance.status != 'draft':
                for field in ['scheme_type', 'review_year', 'notes']:
                    if field in attrs and attrs[field] != getattr(self.instance, field):
                        raise serializers.ValidationError({
                            field: f"The {field.replace('_', ' ')} cannot be changed on a published or deactivated version."
                        })
        return attrs

    def create(self, validated_data):
        if 'request' in self.context:
            user = self.context['request'].user
            if user and user.is_authenticated:
                validated_data['created_by'] = user
        return super().create(validated_data)


class LoadSheddingAlertConfigSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LoadSheddingAlertConfig
        fields = [
            'id', 'scheme_type',
            'ufls_protected_stages', 'critical_restricted_stages',
            'rule1_enforcement', 'rule2_enforcement', 'updated_at', 'updated_by', 'updated_by_name',
        ]
        read_only_fields = ['updated_at', 'updated_by', 'updated_by_name']

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None


