from rest_framework import serializers
from core.models import Substation, Transformer, IncomingBay
import logging

logger = logging.getLogger(__name__)

class LoadDataSerializer(serializers.Serializer):
    pload_mw = serializers.FloatField()
    qload_mvar = serializers.FloatField()

class TransformerSerializer(serializers.ModelSerializer):
    substation = serializers.PrimaryKeyRelatedField(read_only=True)
    bay_id = serializers.CharField(read_only=True) # Auto-generated
    load_data = LoadDataSerializer(read_only=True)
    
    class Meta:
        model = Transformer
        fields = '__all__'

class IncomingBaySerializer(serializers.ModelSerializer):
    substation = serializers.PrimaryKeyRelatedField(read_only=True)
    bay_id = serializers.CharField(read_only=True) # Auto-generated
    load_data = LoadDataSerializer(read_only=True)

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
                  'created_at', 'updated_at', 'total_pload_mw', 'total_qload_mvar']
        read_only_fields = ['substation_id', 'sld', 'created_at', 'updated_at', 'region', 'state', 'total_pload_mw', 'total_qload_mvar']

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
                # Extract many-to-many fields (can't be set during creation)
                tee_off_connections = b_data.pop('tee_off_connections', None)
                
                # ID generation is handled by Model.save() based on bay_name
                bay = IncomingBay.objects.create(substation=instance, **b_data)
                
                # Set many-to-many relationships after creation
                if tee_off_connections is not None:
                    bay.tee_off_connections.set(tee_off_connections)
            
            # Automatically re-run topology detection for updated bays
            try:
                from services.network_topology import NetworkTopologyService
                # Re-detect topology for this substation's bays
                for bay in instance.incoming_bays.all():
                    detection = NetworkTopologyService.detect_connections(bay)
                    NetworkTopologyService.apply_detection_result(bay, detection)
                logger.info(f"Auto-detected topology for {instance.substation_id} after configuration update")
            except Exception as e:
                logger.error(f"Failed to auto-detect topology after update: {e}")

        return instance
