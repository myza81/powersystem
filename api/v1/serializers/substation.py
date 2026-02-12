from rest_framework import serializers
from core.models import Substation

class SubstationSerializer(serializers.ModelSerializer):
    """
    V2: Simplified Substation Serializer (Master Data only).
    Removed transformers and incoming_bays fields.
    """
    class Meta:
        model = Substation
        fields = ['substation_id', 'mnemonic', 'name', 'ownership', 'voltage', 
                  'grid', 'state', 'region', 'latitude', 'longitude', 
                  'sync_log', 'commission_date', 'sld', 'sld_file',
                  'created_at', 'updated_at']
        read_only_fields = ['substation_id', 'sld', 'created_at', 'updated_at', 'region', 'state']
