from django.contrib import admin
from .models import Substation, Transformer, IncomingBay, BayLoad

class TransformerInline(admin.TabularInline):
    model = Transformer
    extra = 0
    fields = ('bay_id', 'bay_name', 'transformer_type', 'capacity_mva', 'hv_breaker_number', 'lv_breaker_number')

class IncomingBayInline(admin.TabularInline):
    model = IncomingBay
    extra = 0
    fields = ('bay_id', 'bay_name', 'voltage', 'breaker_number')

@admin.register(Substation)
class SubstationAdmin(admin.ModelAdmin):
    list_display = ('substation_id', 'mnemonic', 'name', 'voltage', 'grid', 'state', 'region', 'ownership', 'created_at')
    search_fields = ('substation_id', 'mnemonic', 'name', 'state', 'region')
    list_filter = ('voltage', 'ownership', 'grid', 'region')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [TransformerInline, IncomingBayInline]

@admin.register(Transformer)
class TransformerAdmin(admin.ModelAdmin):
    list_display = ('bay_id', 'substation', 'bay_name', 'transformer_type', 'capacity_mva', 'hv_breaker_number', 'lv_breaker_number')
    search_fields = ('bay_id', 'substation__name', 'substation__substation_id')
    list_filter = ('transformer_type',)

@admin.register(IncomingBay)
class IncomingBayAdmin(admin.ModelAdmin):
    list_display = ('bay_id', 'substation', 'bay_name', 'voltage', 'breaker_number')
    search_fields = ('bay_id', 'substation__name', 'substation__substation_id', 'bay_name')
    list_filter = ('voltage',)

@admin.register(BayLoad)
class BayLoadAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_bay_id', 'mnemonic', 'bay_identifier', 'pload_mw', 'qload_mvar', 'matched', 'upload_timestamp')
    search_fields = ('mnemonic', 'bay_identifier', 'bus_name', 'upload_batch_id')
    list_filter = ('matched', 'upload_timestamp')
    readonly_fields = ('upload_timestamp', 'upload_batch_id')
    date_hierarchy = 'upload_timestamp'
    
    def get_bay_id(self, obj):
        """Display the associated bay_id (transformer or incoming_bay)"""
        if obj.transformer:
            return obj.transformer.bay_id
        elif obj.incoming_bay:
            return obj.incoming_bay.bay_id
        return "Unmatched"
    get_bay_id.short_description = 'Bay ID'
    get_bay_id.admin_order_field = 'transformer__bay_id'

