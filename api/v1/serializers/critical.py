from rest_framework import serializers
from core.models import CriticalCategory, CriticalSource, CriticalAssetTag


class CriticalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalCategory
        fields = ['id', 'category_name', 'slug', 'description']


class CriticalSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalSource
        fields = ['id', 'reference', 'url', 'issued_date', 'notes']


class CriticalAssetTagSerializer(serializers.ModelSerializer):
    load_transformer_bay_id = serializers.CharField(source='load_transformer.bay_id', read_only=True)
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    source_reference = serializers.CharField(source='source.reference', read_only=True)

    class Meta:
        model = CriticalAssetTag
        fields = [
            'id',
            'substation',
            'load_transformer',
            'load_transformer_bay_id',
            'category',
            'category_name',
            'category_slug',
            'severity_rank',
            'source',
            'source_reference',
            'is_inforce',
            'inforce_from',
            'inforce_to',
            'updated_at',
        ]
        read_only_fields = ['load_transformer_bay_id', 'category_name', 'category_slug', 'source_reference', 'updated_at']
