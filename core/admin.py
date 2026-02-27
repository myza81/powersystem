from django.contrib import admin
from .models import (
    Substation,
    NetworkSnapshot,
    NetworkArea,
    NetworkZone,
    NetworkOwner,
    NetworkTopology,
    TopologyVersion,
    TopologyBus,
    TopologyBranch,
    TopologyTransformer,
    SnapshotBusState,
    NetworkLoad,
    NetworkGenerator,
    NetworkShunt,
    NetworkSwitchedShunt,
    NetworkDCLink,
    LoadTransformer,
    IncomingBranch,
    IncomingBranchAlias,
    AutoTransformer,
    EquipmentTopologyMap,
    EquipmentSnapshotState,
    CriticalCategory,
    CriticalSource,
    CriticalAsset,
)

@admin.register(Substation)
class SubstationAdmin(admin.ModelAdmin):
    list_display = ('substation_id', 'mnemonic', 'name', 'voltage', 'grid', 'state', 'region', 'ownership', 'created_at')
    search_fields = ('substation_id', 'mnemonic', 'name', 'state', 'region')
    list_filter = ('voltage', 'ownership', 'grid', 'region')
    readonly_fields = ('created_at', 'updated_at')
    # Removed inlines for now as Transformer/IncomingBay are gone. 
    # Future: specific "Snapshot Views" might be added here.

class IncomingBranchAliasInline(admin.TabularInline):
    model = IncomingBranchAlias
    extra = 0
    fields = ('bay_id', 'effective_from', 'effective_to')

@admin.register(LoadTransformer)
class LoadTransformerAdmin(admin.ModelAdmin):
    list_display = (
        'bay_id', 'substation', 'transformer_no', 
        'hv_voltage', 'hv_breaker_number', 
        'lv_voltage', 'lv_breaker_number', 
        'capacity_mva'
    )
    search_fields = ('bay_id', 'substation__substation_id', 'hv_breaker_number', 'lv_breaker_number')
    list_filter = ('hv_voltage', 'lv_voltage')
    raw_id_fields = ('substation',)

@admin.register(IncomingBranch)
class IncomingBranchAdmin(admin.ModelAdmin):
    list_display = ('bay_id', 'substation', 'to_substation', 'ckt_id', 'breaker_number')
    search_fields = ('bay_id', 'substation__substation_id', 'to_substation__substation_id')
    list_filter = ('substation',)
    raw_id_fields = ('substation', 'to_substation')
    inlines = (IncomingBranchAliasInline,)

@admin.register(AutoTransformer)
class AutoTransformerAdmin(admin.ModelAdmin):
    list_display = (
        'bay_id', 'substation', 'transformer_no', 
        'hv_voltage', 'hv_breaker_number', 
        'lv_voltage', 'lv_breaker_number', 
        'capacity_mva'
    )
    search_fields = ('bay_id', 'substation__substation_id', 'hv_breaker_number', 'lv_breaker_number')
    list_filter = ('hv_voltage', 'lv_voltage')
    raw_id_fields = ('substation',)

@admin.register(EquipmentTopologyMap)
class EquipmentTopologyMapAdmin(admin.ModelAdmin):
    list_display = ('equipment_type', 'topology_version', 'load_transformer', 'incoming_branch', 'auto_transformer', 'topology_transformer', 'topology_branch')
    list_filter = ('equipment_type', 'topology_version')
    raw_id_fields = ('topology_version', 'load_transformer', 'incoming_branch', 'auto_transformer', 'topology_transformer', 'topology_branch')

@admin.register(EquipmentSnapshotState)
class EquipmentSnapshotStateAdmin(admin.ModelAdmin):
    list_display = ('equipment_type', 'snapshot', 'load_transformer', 'incoming_branch', 'auto_transformer', 'in_service', 'state_source', 'updated_at')
    list_filter = ('equipment_type', 'snapshot', 'in_service')
    raw_id_fields = ('snapshot', 'load_transformer', 'incoming_branch', 'auto_transformer')

@admin.register(CriticalCategory)
class CriticalCategoryAdmin(admin.ModelAdmin):
    list_display = ('category_name',)
    search_fields = ('category_name',)

@admin.register(CriticalSource)
class CriticalSourceAdmin(admin.ModelAdmin):
    list_display = ('issued_date', 'source_file')
    search_fields = ('source_file',)
    list_filter = ('issued_date',)

@admin.register(CriticalAsset)
class CriticalAssetAdmin(admin.ModelAdmin):
    list_display = ('asset', 'substation', 'category', 'sensitivity_impact', 'get_transformers_count', 'is_inforce', 'updated_at', 'notes')
    search_fields = ('asset', 'substation__substation_id', 'category__category_name', 'notes')
    list_filter = ('is_inforce', 'category', 'sensitivity_impact', 'substation')
    raw_id_fields = ('substation', 'category', 'source')
    filter_horizontal = ('load_transformers',)

    def get_transformers_count(self, obj):
        return obj.load_transformers.count()
    get_transformers_count.short_description = 'Transformers'

@admin.register(NetworkSnapshot)
class NetworkSnapshotAdmin(admin.ModelAdmin):
    list_display = ('name', 'timestamp', 'import_type', 'base_mva', 'frequency', 'topology_version', 'id')
    search_fields = ('name', 'description')
    readonly_fields = ('timestamp', 'id')

@admin.register(NetworkTopology)
class NetworkTopologyAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)

@admin.register(TopologyVersion)
class TopologyVersionAdmin(admin.ModelAdmin):
    list_display = ('topology', 'version_tag', 'signature', 'created_at')
    search_fields = ('version_tag', 'signature')
    list_filter = ('topology',)

@admin.register(TopologyBus)
class TopologyBusAdmin(admin.ModelAdmin):
    list_display = ('bus_number', 'bus_name', 'base_kv', 'topology_version', 'substation')
    search_fields = ('bus_number', 'bus_name', 'substation__name')
    list_filter = ('topology_version', 'base_kv')
    raw_id_fields = ('topology_version', 'substation')

@admin.register(TopologyBranch)
class TopologyBranchAdmin(admin.ModelAdmin):
    list_display = ('from_bus', 'to_bus', 'ckt_id', 'r', 'x', 'topology_version')
    search_fields = ('from_bus__bus_number', 'to_bus__bus_number', 'ckt_id')
    list_filter = ('topology_version',)
    raw_id_fields = ('topology_version', 'from_bus', 'to_bus')

@admin.register(TopologyTransformer)
class TopologyTransformerAdmin(admin.ModelAdmin):
    list_display = ('from_bus', 'to_bus', 'ckt_id', 'x', 'topology_version')
    search_fields = ('from_bus__bus_number', 'to_bus__bus_number', 'ckt_id')
    list_filter = ('topology_version',)
    raw_id_fields = ('topology_version', 'from_bus', 'to_bus', 'tertiary_bus')

@admin.register(SnapshotBusState)
class SnapshotBusStateAdmin(admin.ModelAdmin):
    list_display = ('snapshot', 'bus', 'bus_type', 'voltage_mag', 'voltage_angle')
    list_filter = ('snapshot', 'bus_type')
    raw_id_fields = ('snapshot', 'bus')

@admin.register(NetworkLoad)
class NetworkLoadAdmin(admin.ModelAdmin):
    list_display = ('bus', 'load_id', 'p_mw', 'q_mvar', 'snapshot')
    search_fields = ('bus__bus_number', 'bus__bus_name', 'load_id', 'snapshot__name')
    list_filter = ('snapshot',)
    raw_id_fields = ('snapshot', 'bus')

@admin.register(NetworkGenerator)
class NetworkGeneratorAdmin(admin.ModelAdmin):
    list_display = ('bus', 'gen_id', 'p_gen', 'q_gen', 'snapshot')
    search_fields = ('bus__bus_number', 'bus__bus_name', 'gen_id', 'snapshot__name')
    list_filter = ('snapshot',)
    raw_id_fields = ('snapshot', 'bus')

# Register Reference Data with proper admin displays
@admin.register(NetworkArea)
class NetworkAreaAdmin(admin.ModelAdmin):
    list_display = ('number', 'name', 'snapshot')
    list_filter = ('snapshot',)
    search_fields = ('number', 'name')
    ordering = ('snapshot', 'number')

@admin.register(NetworkZone)
class NetworkZoneAdmin(admin.ModelAdmin):
    list_display = ('number', 'name', 'snapshot')
    list_filter = ('snapshot',)
    search_fields = ('number', 'name')
    ordering = ('snapshot', 'number')

@admin.register(NetworkOwner)
class NetworkOwnerAdmin(admin.ModelAdmin):
    list_display = ('number', 'name', 'snapshot')
    list_filter = ('snapshot',)
    search_fields = ('number', 'name')
    ordering = ('snapshot', 'number')

@admin.register(NetworkShunt)
class NetworkShuntAdmin(admin.ModelAdmin):
    list_display = ('bus', 'shunt_id', 'g_mw', 'b_mvar', 'in_service', 'snapshot')
    search_fields = ('bus__bus_number', 'bus__bus_name', 'shunt_id', 'snapshot__name')
    list_filter = ('snapshot', 'in_service')
    raw_id_fields = ('snapshot', 'bus')

@admin.register(NetworkSwitchedShunt)
class NetworkSwitchedShuntAdmin(admin.ModelAdmin):
    list_display = ('bus', 'control_mode', 'b_init', 'snapshot')
    search_fields = ('bus__bus_number', 'bus__bus_name', 'snapshot__name')
    list_filter = ('snapshot', 'control_mode')
    raw_id_fields = ('snapshot', 'bus')

@admin.register(NetworkDCLink)
class NetworkDCLinkAdmin(admin.ModelAdmin):
    list_display = ('name', 'rectifier_bus_number', 'inverter_bus_number', 'setpoint_mw', 'snapshot')
    list_filter = ('snapshot',)
    search_fields = ('name', 'rectifier_bus_number', 'inverter_bus_number')
