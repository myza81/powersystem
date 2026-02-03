from rest_framework import serializers
from core.models import Substation, Transformer, IncomingBay

class TransformerSerializer(serializers.ModelSerializer):
    substation = serializers.PrimaryKeyRelatedField(read_only=True)
    bay_id = serializers.CharField(read_only=True) # Auto-generated
    
    class Meta:
        model = Transformer
        fields = '__all__'

class IncomingBaySerializer(serializers.ModelSerializer):
    substation = serializers.PrimaryKeyRelatedField(read_only=True)
    bay_id = serializers.CharField(read_only=True) # Auto-generated

    class Meta:
        model = IncomingBay
        fields = '__all__'

class SubstationSerializer(serializers.ModelSerializer):
    transformers = TransformerSerializer(many=True, required=False)
    incoming_bays = IncomingBaySerializer(many=True, required=False)

    class Meta:
        model = Substation
        fields = ['substation_id', 'mnemonic', 'name', 'ownership', 'voltage', 
                  'grid', 'state', 'region', 'latitude', 'longitude', 
                  'sync_log', 'commission_date', 'sld', 'sld_file', 'transformers', 'incoming_bays',
                  'created_at', 'updated_at']
        read_only_fields = ['substation_id', 'sld', 'created_at', 'updated_at', 'region', 'state']

    def update(self, instance, validated_data):
        transformers_data = validated_data.pop('transformers', None)
        bays_data = validated_data.pop('incoming_bays', None)

        # Update Substation fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update Transformers (Full Replace Strategy)
        if transformers_data is not None:
            instance.transformers.all().delete()
            for t_data in transformers_data:
                # ID generation is handled by Model.save() based on bay_name
                Transformer.objects.create(substation=instance, **t_data)

        # Update Incoming Bays (Full Replace Strategy)
        if bays_data is not None:
            instance.incoming_bays.all().delete()
            for b_data in bays_data:
                # ID generation is handled by Model.save() based on bay_name
                IncomingBay.objects.create(substation=instance, **b_data)

        return instance
