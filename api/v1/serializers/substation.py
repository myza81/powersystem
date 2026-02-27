from rest_framework import serializers
from core.models import (
    Substation,
    LoadTransformer,
    IncomingBranch,
    IncomingBranchAlias,
    AutoTransformer,
    EquipmentTopologyMap,
    EquipmentSnapshotState,
)

class SubstationSerializer(serializers.ModelSerializer):
    """
    V2: Simplified Substation Serializer (Master Data only).
    Removed transformers and incoming_bays fields.
    """
    total_pload_mw = serializers.SerializerMethodField()
    is_critical = serializers.SerializerMethodField()
    
    class Meta:
        model = Substation
        fields = ['substation_id', 'mnemonic', 'name', 'ownership', 'voltage', 
                  'grid', 'state', 'region', 'latitude', 'longitude', 
                  'commission_date', 'sld', 'sld_file', 'total_pload_mw', 'is_critical',
                  'created_at', 'updated_at']
        read_only_fields = ['substation_id', 'sld', 'created_at', 'updated_at', 'region', 'state']

    def get_snapshot(self):
        from core.models import NetworkSnapshot
        snapshot_id = self.context.get('snapshot_id')
        if snapshot_id:
            return NetworkSnapshot.objects.filter(id=snapshot_id).first()
        return NetworkSnapshot.objects.order_by('-timestamp').first()

    def get_total_pload_mw(self, obj):
        snapshot = self.get_snapshot()
        if not snapshot:
            return 0.0
        from django.db.models import Sum
        from core.models import TopologyBus, NetworkLoad
        bus_ids = TopologyBus.objects.filter(
            topology_version=snapshot.topology_version,
            substation=obj,
        ).values_list('id', flat=True)
        return NetworkLoad.objects.filter(snapshot=snapshot, bus_id__in=bus_ids).aggregate(
            t=Sum('p_mw')
        )['t'] or 0.0
    
    def get_is_critical(self, obj):
        from core.models import CriticalAsset
        return CriticalAsset.objects.filter(substation=obj, is_inforce=True).exists()

class TransformerDetailSerializer(serializers.Serializer):
    """
    Serializer for aggregating transformer data
    """
    id = serializers.CharField()
    name = serializers.CharField()
    type = serializers.CharField()
    voltage_ratio = serializers.CharField()
    load_mw = serializers.FloatField()
    load_mvar = serializers.FloatField()
    
    # Detailed Winding Information
    nomv1 = serializers.FloatField()
    nomv2 = serializers.FloatField()
    nomv3 = serializers.FloatField(allow_null=True)
    windv1 = serializers.FloatField()
    windv2 = serializers.FloatField()
    windv3 = serializers.FloatField(allow_null=True)

class SubstationDetailSerializer(SubstationSerializer):
    """
    V2: Detailed Substation Serializer (Includes live network data).
    Used for single-item lookups (Search/Detail view).
    """
    transformers = serializers.SerializerMethodField()
    
    class Meta(SubstationSerializer.Meta):
        fields = SubstationSerializer.Meta.fields + ['transformers']

    def get_transformers(self, obj):
        snapshot = self.get_snapshot()
        if not snapshot:
            return []
        
        from django.db.models import Q
        transformers = []
        from core.models import TopologyBus
        bus_ids = list(TopologyBus.objects.filter(
            topology_version=snapshot.topology_version,
            substation=obj,
        ).values_list('id', flat=True))
        
        # 1. Physical Transformers (TopologyTransformer)
        from core.models import TopologyTransformer
        tx_queryset = TopologyTransformer.objects.filter(
            topology_version=snapshot.topology_version
        ).filter(
            Q(from_bus_id__in=bus_ids) | Q(to_bus_id__in=bus_ids)
        ).distinct().select_related('from_bus', 'to_bus', 'tertiary_bus')
        
        from django.db.models import Sum
        for tx in tx_queryset:
            load_bus = tx.to_bus if tx.to_bus_id in bus_ids else tx.from_bus
            load_data = load_bus.loads.aggregate(p=Sum('p_mw'), q=Sum('q_mvar'))
            
            transformers.append({
                'id': f"TX-{tx.ckt_id}-{tx.from_bus.bus_number}-{tx.to_bus.bus_number}",
                'name': f"TX {tx.ckt_id}",
                'type': 'Transformer',
                'voltage_ratio': f"{tx.from_bus.base_kv:.0f}/{tx.to_bus.base_kv:.0f}kV" + (f"/{tx.tertiary_bus.base_kv:.0f}kV" if tx.tertiary_bus else ""),
                'load_mw': round(load_data['p'] or 0.0, 2),
                'load_mvar': round(load_data['q'] or 0.0, 2),
                'nomv1': tx.nomv1,
                'nomv2': tx.nomv2,
                'nomv3': tx.nomv3,
                'windv1': tx.windv1,
                'windv2': tx.windv2,
                'windv3': tx.windv3
            })

        # 2. Modeled Transformers (NetworkLoad with T-prefixed IDs)
        from core.models import NetworkLoad
        load_txs = NetworkLoad.objects.filter(
            snapshot=snapshot,
            bus_id__in=bus_ids,
            load_id__istartswith='T'
        ).select_related('bus')

        for ltx in load_txs:
            # Check for duplicates (if already found as physical TX)
            if any(t['name'] == f"TX {ltx.load_id.strip()}" for t in transformers):
                continue

            transformers.append({
                'id': f"LOAD-TX-{ltx.load_id}-{ltx.bus.bus_number}",
                'name': f"TX {ltx.load_id.strip()}",
                'type': 'Load-Based',
                'voltage_ratio': f"{ltx.bus.base_kv:.0f}kV LV", # Only have one side info
                'load_mw': round(ltx.p_mw, 2),
                'load_mvar': round(ltx.q_mvar, 2),
                'nomv1': ltx.bus.base_kv,
                'nomv2': 0.0,
                'nomv3': None,
                'windv1': 1.0,
                'windv2': 0.0,
                'windv3': None
            })
            
        return transformers


class LoadTransformerSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadTransformer
        fields = [
            'id', 'bay_id', 'substation', 'transformer_no',
            'hv_voltage', 'hv_breaker_number',
            'lv_voltage', 'lv_breaker_number',
            'capacity_mva', 'commissioning_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['bay_id', 'created_at', 'updated_at']


class IncomingBranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingBranch
        fields = [
            'id', 'bay_id', 'substation', 'to_substation', 'ckt_id',
            'breaker_number', 'commissioning_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['bay_id', 'created_at', 'updated_at']


class IncomingBranchAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingBranchAlias
        fields = ['id', 'incoming_branch', 'bay_id', 'effective_from', 'effective_to']


class AutoTransformerSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutoTransformer
        fields = [
            'id', 'bay_id', 'substation', 'transformer_no',
            'hv_voltage', 'hv_breaker_number',
            'lv_voltage', 'lv_breaker_number',
            'capacity_mva', 'commissioning_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['bay_id', 'created_at', 'updated_at']


class EquipmentTopologyMapSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentTopologyMap
        fields = [
            'id', 'equipment_type', 'topology_version',
            'load_transformer', 'incoming_branch', 'auto_transformer',
            'topology_transformer', 'topology_branch',
            'created_at'
        ]
        read_only_fields = ['created_at']


class EquipmentSnapshotStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentSnapshotState
        fields = [
            'id', 'snapshot', 'equipment_type',
            'load_transformer', 'incoming_branch', 'auto_transformer',
            'in_service', 'state_source', 'updated_at'
        ]
        read_only_fields = ['updated_at']
