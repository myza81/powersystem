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
)

@admin.register(Substation)
class SubstationAdmin(admin.ModelAdmin):
    list_display = ('substation_id', 'mnemonic', 'name', 'voltage', 'grid', 'state', 'region', 'ownership', 'created_at')
    search_fields = ('substation_id', 'mnemonic', 'name', 'state', 'region')
    list_filter = ('voltage', 'ownership', 'grid', 'region')
    readonly_fields = ('created_at', 'updated_at')
    # Removed inlines for now as Transformer/IncomingBay are gone. 
    # Future: specific "Snapshot Views" might be added here.

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


