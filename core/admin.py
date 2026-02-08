from django.contrib import admin
from django.utils import timezone
from .models import Substation, Transformer, IncomingBay, BayLoad
from services.network_topology import NetworkTopologyService

class TransformerInline(admin.TabularInline):
    model = Transformer
    extra = 0
    fields = ('bay_id', 'bay_name', 'transformer_type', 'capacity_mva', 'hv_breaker_number', 'lv_breaker_number')

class IncomingBayInline(admin.TabularInline):
    model = IncomingBay
    fk_name = 'substation'  # Specify which FK to use (not connected_to_substation)
    extra = 0
    fields = ('bay_id', 'bay_name', 'voltage', 'breaker_number', 'connection_type', 'validation_status')
    readonly_fields = ('bay_id',)

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
    list_display = (
        'bay_id', 
        'substation', 
        'bay_name', 
        'connection_type',
        'validation_status_badge',
        'connected_to_substation',
        'detection_confidence',
    )
    search_fields = (
        'bay_id', 
        'substation__name', 
        'substation__substation_id', 
        'bay_name',
        'connected_to_substation__name',
        'connected_to_substation__substation_id',
    )
    list_filter = (
        'validation_status',
        'connection_type',
        'auto_detected',
        'topology_changed',
        'voltage',
    )
    readonly_fields = (
        'bay_id',
        'auto_detected',
        'detection_confidence',
        'detection_note',
        'validated_by',
        'validated_at',
        'topology_last_checked',
        'created_at',
        'updated_at',
        'connection_summary',
    )
    fieldsets = (
        ('Basic Information', {
            'fields': ('substation', 'bay_name', 'bay_id', 'voltage', 'breaker_number', 'sequence_number', 'is_active')
        }),
        ('Network Topology', {
            'fields': (
                'connection_type',
                'connected_to_substation',
                'tee_off_connections',
                'connection_summary',
            )
        }),
        ('Validation', {
            'fields': (
                'validation_status',
                'auto_detected',
                'detection_confidence',
                'detection_note',
                'validated_by',
                'validated_at',
            )
        }),
        ('Change Tracking', {
            'fields': (
                'topology_changed',
                'topology_last_checked',
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',)
        }),
    )
    
    def validation_status_badge(self, obj):
        """Display validation status with color coding"""
        from django.utils.html import format_html
        
        colors = {
            'PENDING': '#FFA500',  # Orange
            'VALIDATED': '#28A745',  # Green
            'AUTO_VALIDATED': '#007BFF',  # Blue
            'REJECTED': '#DC3545',  # Red
        }
        color = colors.get(obj.validation_status, '#6C757D')
        
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_validation_status_display()
        )
    validation_status_badge.short_description = 'Status'
    validation_status_badge.admin_order_field = 'validation_status'
    
    # Admin actions
    actions = ['approve_selected', 'reject_selected', 'redetect_selected']
    
    @admin.action(description='Approve selected connections')
    def approve_selected(self, request, queryset):
        """Bulk approve selected connections"""
        updated = queryset.update(
            validation_status='VALIDATED',
            validated_by=request.user,
            validated_at=timezone.now(),
            topology_changed=False
        )
        self.message_user(request, f'{updated} connections approved.')
    
    @admin.action(description='Reject selected connections')
    def reject_selected(self, request, queryset):
        """Bulk reject selected connections"""
        updated = queryset.update(
            validation_status='REJECTED',
            validated_by=request.user,
            validated_at=timezone.now(),
            topology_changed=False
        )
        self.message_user(request, f'{updated} connections rejected.')
    
    @admin.action(description='Re-run detection on selected bays')
    def redetect_selected(self, request, queryset):
        """Re-run topology detection on selected bays"""
        updated = 0
        for bay in queryset:
            detection = NetworkTopologyService.detect_connections(bay)
            NetworkTopologyService.apply_detection_result(bay, detection)
            updated += 1
        self.message_user(request, f'Re-detected {updated} connections.')

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

