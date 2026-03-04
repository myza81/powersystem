from django.contrib import admin
from django import forms
from django.core.exceptions import ValidationError
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
    LoadSheddingRelay,
    LoadSheddingSetting,
    LoadSheddingVersion,
    LoadSheddingStage,
    LoadSheddingStageSetting,
    LoadSheddingTransformerBay,
    LoadSheddingSpurBay,
    LoadSheddingPocketBay,
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

@admin.register(LoadSheddingRelay)
class LoadSheddingRelayAdmin(admin.ModelAdmin):
    class LoadSheddingRelayForm(forms.ModelForm):
        def clean(self):
            cleaned_data = super().clean()
            relay = self.instance

            load_transformers = cleaned_data.get('load_transformers')
            incoming_branches = cleaned_data.get('incoming_branches')
            auto_transformers = cleaned_data.get('auto_transformers')

            errors = {}

            if load_transformers:
                conflicts = load_transformers.exclude(load_shedding_relays=relay).filter(
                    load_shedding_relays__isnull=False
                )
                if conflicts.exists():
                    errors['load_transformers'] = (
                        'One or more load transformers are already linked to another relay.'
                    )

            if incoming_branches:
                conflicts = incoming_branches.exclude(load_shedding_relays=relay).filter(
                    load_shedding_relays__isnull=False
                )
                if conflicts.exists():
                    errors['incoming_branches'] = (
                        'One or more incoming branches are already linked to another relay.'
                    )

            if auto_transformers:
                conflicts = auto_transformers.exclude(load_shedding_relays=relay).filter(
                    load_shedding_relays__isnull=False
                )
                if conflicts.exists():
                    errors['auto_transformers'] = (
                        'One or more auto transformers are already linked to another relay.'
                    )

            if errors:
                raise ValidationError(errors)

            return cleaned_data

    form = LoadSheddingRelayForm
    list_display = (
        'substation',
        'is_active',
        'load_transformer_bays',
        'incoming_branch_bays',
        'auto_transformer_bays',
    )
    list_filter = ('is_active', 'substation')
    search_fields = ('id', 'substation__substation_id')
    raw_id_fields = ('substation',)
    filter_horizontal = ('load_transformers', 'incoming_branches', 'auto_transformers')

    def load_transformer_bays(self, obj):
        bays = obj.load_transformers.values_list('bay_id', flat=True)
        return ', '.join([bay.split('_')[-1] for bay in bays if bay and '_' in bay])
    load_transformer_bays.short_description = 'Load Transformers'

    def incoming_branch_bays(self, obj):
        bays = obj.incoming_branches.values_list('bay_id', flat=True)
        return ', '.join([bay.split('_')[-1] for bay in bays if bay and '_' in bay])
    incoming_branch_bays.short_description = 'Circuit (Line/Cable)'

    def auto_transformer_bays(self, obj):
        bays = obj.auto_transformers.values_list('bay_id', flat=True)
        return ', '.join([bay.split('_')[-1] for bay in bays if bay and '_' in bay])
    auto_transformer_bays.short_description = 'Auto Transformers'

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

# ==========================================
# 7. LOAD SHEDDING (Versioned)
# ==========================================

@admin.register(LoadSheddingSetting)
class LoadSheddingSettingAdmin(admin.ModelAdmin):
    list_display = ('label', 'scheme_type', 'threshold', 'time_delay')
    list_filter = ('scheme_type',)
    search_fields = ('label',)


class LoadSheddingStageSettingInlineFormSet(forms.BaseInlineFormSet):
    def clean(self):
        super().clean()
        # EMLS stages have no threshold/delay settings — skip enforcement
        stage = getattr(self, 'instance', None)
        if stage and stage.pk:
            try:
                if stage.version.scheme_type == 'EMLS':
                    return
            except Exception:
                pass
        has_active = False
        for form in self.forms:
            if not hasattr(form, 'cleaned_data'):
                continue
            if form.cleaned_data.get('DELETE'):
                continue
            if form.cleaned_data.get('setting'):
                has_active = True
                break
        if not has_active:
            raise ValidationError("At least one setting is required for UFLS/UVLS stages.")


class LoadSheddingStageSettingInline(admin.TabularInline):
    model = LoadSheddingStageSetting
    extra = 1
    raw_id_fields = ('setting',)
    exclude = ('version',)
    formset = LoadSheddingStageSettingInlineFormSet


@admin.register(LoadSheddingStage)
class LoadSheddingStageAdmin(admin.ModelAdmin):
    list_display = ('version', 'stage_number', 'label', 'settings_summary')
    list_filter = ('version__scheme_type', 'version')
    search_fields = ('label',)
    inlines = [LoadSheddingStageSettingInline]
    raw_id_fields = ('version',)

    def settings_summary(self, obj):
        return ", ".join(s.label for s in obj.settings.all())

    settings_summary.short_description = "Settings"


class LoadSheddingStageInline(admin.TabularInline):
    model = LoadSheddingStage
    extra = 1
    fields = ('label', 'settings_summary')
    readonly_fields = ('settings_summary',)

    def settings_summary(self, obj):
        return ", ".join(s.label for s in obj.settings.all())

    settings_summary.short_description = "Settings"


@admin.register(LoadSheddingVersion)
class LoadSheddingVersionAdmin(admin.ModelAdmin):
    list_display = ('scheme_type', 'version_label', 'status', 'is_active', 'published_at', 'created_at')
    list_filter = ('scheme_type', 'status', 'is_active')
    search_fields = ('version_label', 'notes')
    inlines = [LoadSheddingStageInline]
    readonly_fields = ('published_at', 'created_at', 'updated_at')
    actions = ['make_published']

    def make_published(self, request, queryset):
        for version in queryset:
            version.publish(user=request.user)
    make_published.short_description = "Publish selected versions (And de-activate older ones)"


@admin.register(LoadSheddingTransformerBay)
class LoadSheddingTransformerBayAdmin(admin.ModelAdmin):
    list_display = ('get_version', 'stage', 'relay', 'transformers_summary')
    list_filter = ('stage__version__scheme_type', 'stage__version')
    filter_horizontal = ('transformers',)
    raw_id_fields = ('stage', 'relay')

    def get_version(self, obj):
        return obj.stage.version
    get_version.short_description = "Version"
    get_version.admin_order_field = "stage__version"

    class LoadSheddingTransformerBayForm(forms.ModelForm):
        class Meta:
            model = LoadSheddingTransformerBay
            fields = '__all__'

        def clean(self):
            cleaned = super().clean()
            relay = cleaned.get('relay')
            transformers = cleaned.get('transformers')
            if relay and transformers:
                allowed_ids = set(relay.load_transformers.values_list('id', flat=True))
                selected_ids = {t.id for t in transformers}
                if not selected_ids.issubset(allowed_ids):
                    raise ValidationError("Selected transformers must belong to the relay's load transformers.")
            return cleaned

    form = LoadSheddingTransformerBayForm

    def transformers_summary(self, obj):
        def fmt(transformer):
            # Extract just the transformer part e.g. "T1" from "ABBA132_T1"
            tx_part = transformer.bay_id.split('_')[-1] if transformer.bay_id and '_' in transformer.bay_id else transformer.bay_id
            voltage = f"_{transformer.lv_voltage}kV" if transformer.lv_voltage is not None else ""
            return f"{tx_part}{voltage}"

        return ", ".join(fmt(t) for t in obj.transformers.all())

    transformers_summary.short_description = "Transformers"

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == 'transformers':
            kwargs['queryset'] = LoadTransformer.objects.all()
        field = super().formfield_for_manytomany(db_field, request, **kwargs)
        if db_field.name == 'transformers':
            def label_from_instance(transformer):
                voltage = f"_{transformer.lv_voltage}kV" if transformer.lv_voltage is not None else ""
                return f"{transformer.bay_id}{voltage}"

            field.label_from_instance = label_from_instance
        return field


@admin.register(LoadSheddingSpurBay)
class LoadSheddingSpurBayAdmin(admin.ModelAdmin):
    list_display = ('stage', 'relay', 'branches_summary')
    filter_horizontal = ('branches',)
    raw_id_fields = ('stage', 'relay')

    class LoadSheddingSpurBayForm(forms.ModelForm):
        class Meta:
            model = LoadSheddingSpurBay
            fields = '__all__'

        def clean(self):
            cleaned = super().clean()
            relay = cleaned.get('relay')
            branches = cleaned.get('branches')
            if relay and branches:
                allowed_ids = set(relay.incoming_branches.values_list('id', flat=True))
                selected_ids = {b.id for b in branches}
                if not selected_ids.issubset(allowed_ids):
                    raise ValidationError("Selected branches must belong to the relay's incoming branches.")
            return cleaned

    form = LoadSheddingSpurBayForm

    def branches_summary(self, obj):
        return ", ".join(b.bay_id for b in obj.branches.all())
    branches_summary.short_description = "Branches"


@admin.register(LoadSheddingPocketBay)
class LoadSheddingPocketBayAdmin(admin.ModelAdmin):
    list_display = ('stage', 'topology_valid', 'topology_alert')
    filter_horizontal = ('boundary_relays', 'boundary_branches')
    raw_id_fields = ('stage',)
    readonly_fields = ('topology_valid', 'topology_alert')

    class LoadSheddingPocketBayForm(forms.ModelForm):
        class Meta:
            model = LoadSheddingPocketBay
            fields = '__all__'

        def clean(self):
            cleaned = super().clean()
            boundary_relays = cleaned.get('boundary_relays')
            boundary_branches = cleaned.get('boundary_branches')
            if boundary_relays and boundary_branches:
                allowed_ids = set()
                for relay in boundary_relays:
                    allowed_ids.update(relay.incoming_branches.values_list('id', flat=True))
                selected_ids = {b.id for b in boundary_branches}
                if not selected_ids.issubset(allowed_ids):
                    raise ValidationError("All selected boundary branches must belong to one of the selected boundary relays.")
            return cleaned

    form = LoadSheddingPocketBayForm
