from rest_framework import serializers
from core.models import CriticalCategory, CriticalSource, CriticalAsset


class CriticalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalCategory
        fields = ['id', 'category_name', 'slug']


class CriticalSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalSource
        fields = ['id', 'source_file', 'issued_date']


class CriticalAssetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    source_reference = serializers.SerializerMethodField()
    source_file = serializers.FileField(source='source.source_file', read_only=True)

    load_transformers_details = serializers.SerializerMethodField()

    class Meta:
        model = CriticalAsset
        fields = [
            'id', 'asset', 'substation', 'load_transformers', 'load_transformers_details', 'category', 'category_name', 'category_slug',
            'sensitivity_impact', 'source', 'source_reference', 'source_file',
            'notes', 'is_inforce', 'created_at', 'updated_at'
        ]

    def get_load_transformers_details(self, obj):
        return [
            {
                'id': lt.id,
                'bay_id': lt.bay_id,
                'lv_voltage': lt.lv_voltage,
            } for lt in obj.load_transformers.all()
        ]

    def get_source_reference(self, obj):
        if not obj.source or not obj.source.source_file:
            return None
        import os
        return os.path.basename(obj.source.source_file.name)


