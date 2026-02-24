from rest_framework import serializers
from core.models import CriticalCategory, CriticalSource, CriticalAssetTag


class CriticalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalCategory
        fields = ['id', 'category_name', 'slug', 'description']


class CriticalSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalSource
        fields = ['id', 'reference', 'source_file', 'issued_date', 'notes']


class CriticalAssetTagSerializer(serializers.ModelSerializer):
    load_transformer_bay_id = serializers.CharField(source='load_transformer.bay_id', read_only=True)
    load_transformer_lv_voltage = serializers.IntegerField(source='load_transformer.lv_voltage', read_only=True)
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    source_reference = serializers.CharField(source='source.reference', read_only=True)
    source_file = serializers.FileField(source='source.source_file', read_only=True)

    class Meta:
        model = CriticalAssetTag
        fields = [
            'id',
            'substation',
            'load_transformer',
            'load_transformer_bay_id',
            'load_transformer_lv_voltage',
            'category',
            'category_name',
            'category_slug',
            'severity_rank',
            'source',
            'source_reference',
            'source_file',
            'short_text',
            'is_inforce',
            'updated_at',
        ]
        read_only_fields = ['load_transformer_bay_id', 'load_transformer_lv_voltage', 'category_name', 'category_slug', 'source_reference', 'source_file', 'updated_at']

    def validate(self, attrs):
        substation = attrs.get('substation') or getattr(self.instance, 'substation', None)
        load_transformer = attrs.get('load_transformer') or getattr(self.instance, 'load_transformer', None)
        if substation and load_transformer and load_transformer.substation_id != substation.substation_id:
            raise serializers.ValidationError({'load_transformer': 'LoadTransformer must belong to the selected substation.'})
        return attrs
