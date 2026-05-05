from rest_framework import serializers
from django.db.models import Sum
from core.models import (
    Substation,
    LoadTransformer,
    IncomingBranch,
    IncomingBranchAlias,
    AutoTransformer,
    EquipmentTopologyMap,
    EquipmentSnapshotState,
    LoadSheddingRelay,
)
from api.v1.serializers.critical import CriticalAssetSerializer


def _get_snapshot_from_context(context):
    from core.models import NetworkSnapshot
    snapshot_id = context.get('snapshot_id')
    if snapshot_id:
        return NetworkSnapshot.objects.filter(id=snapshot_id).first()
    cache_key = '_latest_snapshot'
    if cache_key not in context:
        context[cache_key] = NetworkSnapshot.objects.order_by('-timestamp').first()
    return context[cache_key]


def _get_substation_load_totals(context, substation):
    snapshot = _get_snapshot_from_context(context)
    if not snapshot or not substation:
        return {'p_mw': None, 'q_mvar': None}

    substation_id = getattr(substation, 'substation_id', substation)
    cache = context.setdefault('_substation_load_totals', {})
    cache_key = (str(snapshot.id), substation_id)
    if cache_key in cache:
        return cache[cache_key]

    from core.models import TopologyBus, NetworkLoad
    bus_ids = TopologyBus.objects.filter(
        topology_version=snapshot.topology_version,
        substation_id=substation_id,
    ).values_list('id', flat=True)
    totals = NetworkLoad.objects.filter(snapshot=snapshot, bus_id__in=bus_ids, in_service=True).aggregate(
        p=Sum('p_mw'),
        q=Sum('q_mvar'),
    )
    cache[cache_key] = {
        'p_mw': round(totals['p'] or 0.0, 2),
        'q_mvar': round(totals['q'] or 0.0, 2),
    }
    return cache[cache_key]


def _sum_matching_loads(loads, load_ids):
    normalized_ids = {str(load_id).strip() for load_id in load_ids if load_id is not None and str(load_id).strip()}
    matched = [
        load for load in loads
        if str(load.load_id).strip() in normalized_ids
    ]
    if not matched:
        return None
    return {
        'p_mw': round(sum(load.p_mw or 0.0 for load in matched), 2),
        'q_mvar': round(sum(load.q_mvar or 0.0 for load in matched), 2),
    }


def _get_transformer_load_totals(context, transformer_obj, equipment_type='load_transformer', load_prefix='T'):
    snapshot = _get_snapshot_from_context(context)
    if not snapshot or not transformer_obj or transformer_obj.transformer_no is None:
        return {'p_mw': None, 'q_mvar': None}

    transformer_no = transformer_obj.transformer_no
    substation = transformer_obj.substation
    substation_id = getattr(substation, 'substation_id', substation)
    load_ids = [str(transformer_no), f'{transformer_no} ']
    if load_prefix:
        load_ids.append(f'{load_prefix}{transformer_no}')

    cache = context.setdefault('_transformer_load_totals', {})
    cache_key = (str(snapshot.id), equipment_type, transformer_obj.id)
    if cache_key in cache:
        return cache[cache_key]

    from core.models import EquipmentTopologyMap, TopologyBus, NetworkLoad

    map_filter = {
        'topology_version': snapshot.topology_version,
        'equipment_type': equipment_type,
    }
    if equipment_type == 'auto_transformer':
        map_filter['auto_transformer'] = transformer_obj
    else:
        map_filter['load_transformer'] = transformer_obj

    mapping = EquipmentTopologyMap.objects.filter(**map_filter).select_related(
        'topology_transformer__from_bus',
        'topology_transformer__to_bus',
        'topology_transformer__tertiary_bus',
    ).first()

    if mapping and mapping.topology_transformer:
        tx = mapping.topology_transformer
        mapped_ids = load_ids + [tx.ckt_id, str(tx.ckt_id).strip()]
        mapped_bus_ids = [bus_id for bus_id in [tx.to_bus_id, tx.from_bus_id, tx.tertiary_bus_id] if bus_id]
        mapped_loads = list(NetworkLoad.objects.filter(snapshot=snapshot, bus_id__in=mapped_bus_ids, in_service=True))
        mapped_totals = _sum_matching_loads(mapped_loads, mapped_ids)
        if mapped_totals is not None:
            cache[cache_key] = mapped_totals
            return cache[cache_key]

    bus_ids = TopologyBus.objects.filter(
        topology_version=snapshot.topology_version,
        substation_id=substation_id,
    ).values_list('id', flat=True)
    substation_loads = list(NetworkLoad.objects.filter(snapshot=snapshot, bus_id__in=bus_ids, in_service=True))
    cache[cache_key] = _sum_matching_loads(substation_loads, load_ids) or {'p_mw': 0.0, 'q_mvar': 0.0}
    return cache[cache_key]

class SubstationSerializer(serializers.ModelSerializer):
    """
    V2: Simplified Substation Serializer (Master Data only).
    Removed transformers and incoming_bays fields.
    """
    total_pload_mw = serializers.SerializerMethodField()
    is_critical = serializers.SerializerMethodField()
    has_active_relay = serializers.SerializerMethodField()
    relay_scheme_types = serializers.SerializerMethodField()
    relay_stages = serializers.SerializerMethodField()
    transformer_commissioning_years = serializers.SerializerMethodField()

    class Meta:
        model = Substation
        fields = ['substation_id', 'mnemonic', 'name', 'ownership', 'voltage',
                  'grid', 'state', 'region', 'latitude', 'longitude',
                  'commission_date', 'sld', 'sld_file', 'total_pload_mw',
                  'is_critical', 'has_active_relay', 'relay_scheme_types', 'relay_stages',
                  'transformer_commissioning_years', 'created_at', 'updated_at']
        read_only_fields = ['substation_id', 'sld', 'created_at', 'updated_at', 'region', 'state']

    def get_snapshot(self):
        return _get_snapshot_from_context(self.context)

    def get_total_pload_mw(self, obj):
        snapshot = self.get_snapshot()
        if not snapshot:
            return 0.0
        from core.models import TopologyBus, NetworkLoad
        bus_ids = TopologyBus.objects.filter(
            topology_version=snapshot.topology_version,
            substation=obj,
        ).values_list('id', flat=True)
        return NetworkLoad.objects.filter(snapshot=snapshot, bus_id__in=bus_ids).aggregate(
            t=Sum('p_mw')
        )['t'] or 0.0
    
    def get_is_critical(self, obj):
        # Uses prefetched critical_assets when available (list action), avoiding N+1
        return any(ca.is_inforce for ca in obj.critical_assets.all())

    def get_has_active_relay(self, obj):
        # Uses prefetched load_shedding_relays when available (list action), avoiding N+1
        return any(r.is_active for r in obj.load_shedding_relays.all())

    def get_relay_scheme_types(self, obj):
        # Uses precomputed map from viewset context (single query for all substations)
        return sorted(self.context.get('scheme_types_map', {}).get(obj.substation_id, []))

    def get_relay_stages(self, obj):
        return sorted(self.context.get('stages_map', {}).get(obj.substation_id, []))

    def get_transformer_commissioning_years(self, obj):
        # Uses prefetched load_transformers when available (list action), avoiding N+1
        return sorted({
            lt.commissioning_date.year
            for lt in obj.load_transformers.all()
            if lt.commissioning_date is not None
        })

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



class WritableAssetField(serializers.PrimaryKeyRelatedField):
    """
    A field that accepts an ID for writing but returns the full serialized object for reading.
    Useful for M2M fields where the frontend needs rich metadata but sends simple IDs.
    """
    def __init__(self, **kwargs):
        self.serializer_class = kwargs.pop('serializer_class', None)
        super().__init__(**kwargs)

    def to_representation(self, value):
        if self.serializer_class:
            return self.serializer_class(value, context=self.context).data
        return super().to_representation(value)

class LoadTransformerSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    current_mw = serializers.SerializerMethodField()
    current_mvar = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return f'T{obj.transformer_no}'

    def get_current_mw(self, obj):
        return _get_transformer_load_totals(self.context, obj, 'load_transformer').get('p_mw')

    def get_current_mvar(self, obj):
        return _get_transformer_load_totals(self.context, obj, 'load_transformer').get('q_mvar')

    class Meta:
        model = LoadTransformer
        fields = [
            'id', 'bay_id', 'display_name', 'substation', 'transformer_no',
            'hv_voltage', 'hv_breaker_number',
            'lv_voltage', 'lv_breaker_number',
            'capacity_mva', 'commissioning_date', 'current_mw', 'current_mvar',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['bay_id', 'created_at', 'updated_at']


class IncomingBranchSerializer(serializers.ModelSerializer):
    to_substation_detail = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    current_mw = serializers.SerializerMethodField()
    current_mvar = serializers.SerializerMethodField()

    def get_to_substation_detail(self, obj):
        s = obj.to_substation
        if not s:
            return None
        return {
            'substation_id': s.substation_id,
            'name': s.name,
            'latitude': s.latitude,
            'longitude': s.longitude,
            'voltage': s.voltage,
        }

    def get_display_name(self, obj):
        to_id = obj.to_substation.substation_id if obj.to_substation else 'Unknown'
        return f'{to_id} Cct {obj.ckt_id}'

    def get_current_mw(self, obj):
        return None

    def get_current_mvar(self, obj):
        return None

    class Meta:
        model = IncomingBranch
        fields = [
            'id', 'bay_id', 'display_name', 'substation', 'to_substation', 'to_substation_detail', 'ckt_id',
            'breaker_number', 'commissioning_date', 'current_mw', 'current_mvar',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['bay_id', 'created_at', 'updated_at']


class IncomingBranchAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingBranchAlias
        fields = ['id', 'incoming_branch', 'bay_id', 'effective_from', 'effective_to']


class AutoTransformerSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    current_mw = serializers.SerializerMethodField()
    current_mvar = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return f'AT{obj.transformer_no}'

    def get_current_mw(self, obj):
        return _get_transformer_load_totals(self.context, obj, 'auto_transformer', load_prefix='AT').get('p_mw')

    def get_current_mvar(self, obj):
        return _get_transformer_load_totals(self.context, obj, 'auto_transformer', load_prefix='AT').get('q_mvar')

    class Meta:
        model = AutoTransformer
        fields = [
            'id', 'bay_id', 'display_name', 'substation', 'transformer_no',
            'hv_voltage', 'hv_breaker_number',
            'lv_voltage', 'lv_breaker_number',
            'capacity_mva', 'commissioning_date', 'current_mw', 'current_mvar',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['bay_id', 'created_at', 'updated_at']


class LoadSheddingRelaySerializer(serializers.ModelSerializer):
    substation_id = serializers.CharField(source='substation.substation_id', read_only=True)

    load_transformers = WritableAssetField(
        queryset=LoadTransformer.objects.all(), many=True, 
        serializer_class=LoadTransformerSerializer, required=False
    )
    incoming_branches = WritableAssetField(
        queryset=IncomingBranch.objects.all(), many=True, 
        serializer_class=IncomingBranchSerializer, required=False
    )
    auto_transformers = WritableAssetField(
        queryset=AutoTransformer.objects.all(), many=True, 
        serializer_class=AutoTransformerSerializer, required=False
    )

    class Meta:
        model = LoadSheddingRelay
        fields = [
            'id', 'substation', 'substation_id', 'relay_name', 'target_voltage', 'load_transformers', 'incoming_branches',
            'auto_transformers', 'is_active', 'notes'
        ]

    def validate(self, attrs):
        # Overlap check: ensures an asset is assigned only to one relay at a substation.
        substation = attrs.get('substation') or getattr(self.instance, 'substation', None)
        if not substation:
            return attrs

        other_relays = LoadSheddingRelay.objects.filter(substation=substation)
        if self.instance and self.instance.pk:
            other_relays = other_relays.exclude(pk=self.instance.pk)

        # Prefetch relations to avoid N+1 in following loop
        other_relays = other_relays.prefetch_related('load_transformers', 'auto_transformers', 'incoming_branches')

        # Assets in currently being validated data
        current_lt = set(attrs.get('load_transformers', []))
        current_at = set(attrs.get('auto_transformers', []))
        current_ib = set(attrs.get('incoming_branches', []))

        # Handle partial updates
        if self.instance:
            if 'load_transformers' not in attrs:
                current_lt = set(self.instance.load_transformers.all())
            if 'auto_transformers' not in attrs:
                current_at = set(self.instance.auto_transformers.all())
            if 'incoming_branches' not in attrs:
                current_ib = set(self.instance.incoming_branches.all())

        for relay in other_relays:
            # Overlap Load Transformers
            overlap_lt = set(relay.load_transformers.all()) & current_lt
            if overlap_lt:
                names = ", ".join([str(lt) for lt in overlap_lt])
                raise serializers.ValidationError({
                    "load_transformers": f"Transformers ({names}) are already assigned to relay '{relay.relay_name or relay.id}'"
                })
            
            # Overlap Auto Transformers
            overlap_at = set(relay.auto_transformers.all()) & current_at
            if overlap_at:
                names = ", ".join([str(at) for at in overlap_at])
                raise serializers.ValidationError({
                    "auto_transformers": f"Auto Transformers ({names}) are already assigned to relay '{relay.relay_name or relay.id}'"
                })

            # Overlap Incoming Branches
            overlap_ib = set(relay.incoming_branches.all()) & current_ib
            if overlap_ib:
                names = ", ".join([str(ib) for ib in overlap_ib])
                raise serializers.ValidationError({
                    "incoming_branches": f"Branches ({names}) are already assigned to relay '{relay.relay_name or relay.id}'"
                })

        return attrs



class SubstationDetailSerializer(SubstationSerializer):
    """
    V2: Detailed Substation Serializer (Includes live network data + bay assets).
    Used for single-item lookups (GET /substations/{id}/).
    Bay assets are nested to avoid N+1 round-trips from the frontend.
    Prefetch is handled in SubstationViewSet.get_queryset for the retrieve action.
    """
    transformers = serializers.SerializerMethodField()
    load_transformers = LoadTransformerSerializer(many=True, read_only=True)
    auto_transformers = AutoTransformerSerializer(many=True, read_only=True)
    incoming_branches = IncomingBranchSerializer(many=True, read_only=True)
    load_shedding_relays = LoadSheddingRelaySerializer(many=True, read_only=True)
    critical_assets = CriticalAssetSerializer(many=True, read_only=True)

    class Meta(SubstationSerializer.Meta):
        fields = SubstationSerializer.Meta.fields + [
            'transformers',
            'load_transformers',
            'auto_transformers',
            'incoming_branches',
            'load_shedding_relays',
            'critical_assets',
        ]

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

        from core.models import NetworkLoad
        all_sub_loads = list(NetworkLoad.objects.filter(snapshot=snapshot, bus_id__in=bus_ids))
        sub_load_map = {l.load_id: l for l in all_sub_loads}

        from django.db.models import Sum
        for tx in tx_queryset:
            load_bus = tx.to_bus if tx.to_bus_id in bus_ids else tx.from_bus

            target_load = load_bus.loads.filter(load_id=tx.ckt_id).first()
            if not target_load:
                target_load = load_bus.loads.filter(load_id=f"T{tx.ckt_id}").first()
            if not target_load:
                target_load = sub_load_map.get(str(tx.ckt_id))
            if not target_load:
                target_load = sub_load_map.get(f"T{tx.ckt_id}")

            if target_load:
                load_p = target_load.p_mw
                load_q = target_load.q_mvar
            else:
                load_data = load_bus.loads.aggregate(p=Sum('p_mw'), q=Sum('q_mvar'))
                load_p = load_data['p'] or 0.0
                load_q = load_data['q'] or 0.0

            transformers.append({
                'id': f"TX-{tx.ckt_id}-{tx.from_bus.bus_number}-{tx.to_bus.bus_number}",
                'name': f"TX {tx.ckt_id}",
                'type': 'Transformer',
                'voltage_ratio': f"{tx.from_bus.base_kv:.0f}/{tx.to_bus.base_kv:.0f}kV" + (f"/{tx.tertiary_bus.base_kv:.0f}kV" if tx.tertiary_bus else ""),
                'load_mw': round(load_p, 2),
                'load_mvar': round(load_q, 2),
                'nomv1': tx.nomv1,
                'nomv2': tx.nomv2,
                'nomv3': tx.nomv3,
                'windv1': tx.windv1,
                'windv2': tx.windv2,
                'windv3': tx.windv3
            })

        # 2. Modeled Transformers (NetworkLoad with T-prefixed IDs)
        load_txs = NetworkLoad.objects.filter(
            snapshot=snapshot,
            bus_id__in=bus_ids,
            load_id__istartswith='T'
        ).select_related('bus')

        for ltx in load_txs:
            if any(t['name'] == f"TX {ltx.load_id.strip()}" for t in transformers):
                continue
            transformers.append({
                'id': f"LOAD-TX-{ltx.load_id}-{ltx.bus.bus_number}",
                'name': f"TX {ltx.load_id.strip()}",
                'type': 'Load-Based',
                'voltage_ratio': f"{ltx.bus.base_kv:.0f}kV LV",
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
