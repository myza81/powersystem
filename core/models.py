import uuid
from django.db import models
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)

# ==========================================
# 1. UTILITIES & STORAGE (Preserved)
# ==========================================

class OverwriteStorage(FileSystemStorage):
    """
    Custom storage to overwrite existing files with the same name.
    """
    def get_available_name(self, name, max_length=None):
        if self.exists(name):
            os.remove(os.path.join(self.location, name))
        return name

def substation_sld_path(instance, filename):
    # Rename file to {substation_id}.{extension}
    ext = filename.split('.')[-1]
    return f"slds/{instance.substation_id}.{ext}"

# ==========================================
# 2. MASTER DATA (Business Context)
# ==========================================

class Substation(models.Model):
    """
    Master Data entity representing a physical substation site.
    Serves as the 'Anchor' for grouping snapshot comparison.
    """
    OWNERSHIP_CHOICES = [
        ('TNB', 'Tenaga Nasional Berhad (TNB)'),
        ('DC', 'Data Centre (DC)'),
        ('LSS', 'Large Scale Solar (LSS)'),
        ('IPP', 'Independent Power Producer (IPP)'),
        ('LPC', 'Large Power Consumer (LPC)'),
    ]

    GRID_CHOICES = [
        ('KEDP', 'KEDP'), ('PPNG', 'PPNG'), ('PERK', 'PERK'),
        ('SELG', 'SELG'), ('KLUM', 'KLUM'),
        ('NSEM', 'NSEM'), ('MLKA', 'MLKA'), ('JOH2', 'JOH2'), ('JOH1', 'JOH1'),
        ('PHNG', 'PHNG'), ('TERG', 'TERG'), ('KELN', 'KELN'),
    ]

    VOLTAGE_CHOICES = [
        (500, '500 kV'),
        (275, '275 kV'),
        (132, '132 kV'),
    ]

    substation_id = models.CharField(max_length=20, primary_key=True)
    mnemonic = models.CharField(max_length=10, help_text="Unique identifier for matching (e.g. SDAO)")
    name = models.CharField(max_length=100)
    ownership = models.CharField(max_length=50, choices=OWNERSHIP_CHOICES, default='TNB')
    voltage = models.IntegerField(choices=VOLTAGE_CHOICES)
    
    # Metadata
    grid = models.CharField(max_length=10, choices=GRID_CHOICES, null=True, blank=True)
    state = models.CharField(max_length=50, null=True, blank=True)
    region = models.CharField(max_length=20, null=True, blank=True)
    sync_log = models.TextField(null=True, blank=True)
    commission_date = models.DateField(null=True, blank=True)

    # Documents
    sld = models.CharField(max_length=255, help_text="Generated as {substation_id}.pdf")
    sld_file = models.FileField(
        upload_to=substation_sld_path, 
        storage=OverwriteStorage(),
        null=True, blank=True, 
        help_text="Upload PDF or Image SLD"
    )
    
    # Geospatial
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # 1. Automated Region derivation
        region_map = {
            'North': ['KEDP', 'PPNG', 'PERK'],
            'Central': ['SELG', 'KLUM'],
            'South': ['NSEM', 'MLKA', 'JOH2', 'JOH1'],
            'East': ['PHNG', 'TERG', 'KELN'],
        }
        if self.grid:
            for region_name, grids in region_map.items():
                if self.grid in grids:
                    self.region = region_name
                    break
        
        # 2. Ensure sld filename consistency
        if self.sld_file:
            ext = self.sld_file.name.split('.')[-1]
            self.sld = f"{self.substation_id}.{ext}"
        elif not self.sld:
            self.sld = f"{self.substation_id}.pdf"
        
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Substation (Master)"
        verbose_name_plural = "Substations (Master)"
        ordering = ['substation_id']

    def __str__(self):
        return f"{self.name} ({self.substation_id})"

# ==========================================
# 3. SNAPSHOT MANAGEMENT
# ==========================================

class NetworkSnapshot(models.Model):
    """
    Container for a complete network state (PSS/E Case).
    All electrical data is cascaded from this model.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="e.g. 'Feb 2026 Forecast'")
    description = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # System parameters from Case Identification
    base_mva = models.FloatField(default=100.0)
    frequency = models.FloatField(default=50.0)
    
    # File tracking
    source_file = models.FileField(upload_to='snapshots/', null=True, blank=True)
    
    # Metadata for import warnings, alerts, etc.
    metadata = models.JSONField(default=dict, blank=True, help_text="Import metadata including unmatched mnemonics")
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Network Snapshot"

    def __str__(self):
        return f"{self.name} ({self.timestamp.strftime('%Y-%m-%d %H:%M')})"

# ==========================================
# 4. PSS/E REFERENCE ENTITIES (Snapshot-Scoped)
# ==========================================

class NetworkArea(models.Model):
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='areas')
    number = models.IntegerField()
    name = models.CharField(max_length=50, blank=True)
    
    class Meta:
        unique_together = ('snapshot', 'number')
        verbose_name = 'Network Area'
        verbose_name_plural = 'Network Areas'
    
    def __str__(self):
        return f"Area {self.number}: {self.name}"

class NetworkZone(models.Model):
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='zones')
    number = models.IntegerField()
    name = models.CharField(max_length=50, blank=True)
    
    class Meta:
        unique_together = ('snapshot', 'number')
        verbose_name = 'Network Zone'
        verbose_name_plural = 'Network Zones'
    
    def __str__(self):
        return f"Zone {self.number}: {self.name}"

class NetworkOwner(models.Model):
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='owners')
    number = models.IntegerField()
    name = models.CharField(max_length=50, blank=True)
    
    class Meta:
        unique_together = ('snapshot', 'number')
        verbose_name = 'Network Owner'
        verbose_name_plural = 'Network Owners'
    
    def __str__(self):
        return f"Owner {self.number}: {self.name}"

# ==========================================
# 5. NODAL TOPOLOGY (The Backbone)
# ==========================================

class NetworkBus(models.Model):
    """
    Fundamental node in the network.
    The primary key is the PSS/E Bus Number + Snapshot.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='buses')
    
    # The Link: Connection to Master Data (Business Context)
    substation = models.ForeignKey(
        Substation, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='snapshot_buses',
        help_text="Linked Master Substation"
    )
    
    # Electrical Identity
    bus_number = models.IntegerField(db_index=True)
    bus_name = models.CharField(max_length=20)
    base_kv = models.FloatField(db_index=True)
    
    # Metadata (PSS/E Source)
    psse_area = models.ForeignKey(NetworkArea, on_delete=models.SET_NULL, null=True, blank=True)
    psse_zone = models.ForeignKey(NetworkZone, on_delete=models.SET_NULL, null=True, blank=True)
    psse_owner = models.ForeignKey(NetworkOwner, on_delete=models.SET_NULL, null=True, blank=True)
    
    # State (Solution)
    voltage_mag = models.FloatField(help_text="Voltage Magnitude (pu)")
    voltage_angle = models.FloatField(help_text="Voltage Angle (degrees)")
    
    # Limits (Optional/Future)
    nv_hi = models.FloatField(null=True, blank=True)
    nv_lo = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ('snapshot', 'bus_number')
        indexes = [
            models.Index(fields=['snapshot', 'bus_number']), # Composite Index for fast lookup
            models.Index(fields=['snapshot', 'substation']),
        ]

    def __str__(self):
        return f"{self.bus_number} {self.bus_name}"

# ==========================================
# 6. CONNECTED EQUIPMENT (Branches & Shunts)
# ==========================================

class NetworkBranch(models.Model):
    """
    AC Transmission Line or Cable.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='branches')
    from_bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='branches_from')
    to_bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='branches_to')
    ckt_id = models.CharField(max_length=2, default='1')
    
    # Parameters
    r = models.FloatField(help_text="Resistance (pu)")
    x = models.FloatField(help_text="Reactance (pu)")
    b = models.FloatField(help_text="Charging (pu)")
    
    # Ratings (MVA)
    rate_a = models.FloatField(default=0.0)
    rate_b = models.FloatField(default=0.0)
    rate_c = models.FloatField(default=0.0)
    
    is_active = models.BooleanField(default=True) # Status

    class Meta:
        indexes = [models.Index(fields=['snapshot', 'from_bus', 'to_bus'])]

class NetworkTransformer(models.Model):
    """
    2-Winding or 3-Winding Transformer.
    Note: 3-winding transformers in PSS/E are often 3x 2-winding records or star point buses.
    This model handles the 2-winding record format primarily.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='transformers')
    from_bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='transformers_from')
    to_bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='transformers_to')
    ckt_id = models.CharField(max_length=2, default='1')
    
    # Parameters
    r = models.FloatField(default=0.0)
    x = models.FloatField()
    primary_winding = models.IntegerField(default=1) # 1=from, 2=to
    
    # Ratings
    rate_a = models.FloatField(default=0.0)
    
    is_active = models.BooleanField(default=True)

class NetworkLoad(models.Model):
    """
    Power consumption at a bus.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='loads')
    bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='loads')
    load_id = models.CharField(max_length=2)
    
    # Values
    p_mw = models.FloatField()
    q_mvar = models.FloatField()
    
    in_service = models.BooleanField(default=True)

class NetworkGenerator(models.Model):
    """
    Power generation unit.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='generators')
    bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='generators')
    gen_id = models.CharField(max_length=2)
    
    # Output
    p_gen = models.FloatField()
    q_gen = models.FloatField()
    
    # Limits
    p_max = models.FloatField()
    p_min = models.FloatField()
    q_max = models.FloatField()
    q_min = models.FloatField()
    
    in_service = models.BooleanField(default=True)

class NetworkShunt(models.Model):
    """
    Fixed Shunt (Capacitor/Reactor).
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='shunts')
    bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='shunts')
    shunt_id = models.CharField(max_length=2)
    
    g_mw = models.FloatField(help_text="Shunt Conductance")
    b_mvar = models.FloatField(help_text="Shunt Susceptance")
    
    in_service = models.BooleanField(default=True)

class NetworkSwitchedShunt(models.Model):
    """
    Switched Shunt (SVC, Capacitor Bank with steps).
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='switched_shunts')
    bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='switched_shunts')
    
    control_mode = models.IntegerField()
    b_init = models.FloatField()
    
    # Storing steps as JSON or simplified string for now
    step_info = models.TextField(blank=True, null=True)

class NetworkDCLink(models.Model):
    """
    Two-Terminal HVDC Line.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='dc_links')
    name = models.CharField(max_length=50)
    
    # Simplified connectivity
    # PSS/E DC lines connect via rectifier/inverter "converter" buses or direct bus index
    # We will store the descriptive name and main parameters
    
    rectifier_bus_number = models.IntegerField()
    inverter_bus_number = models.IntegerField()
    
    setpoint_mw = models.FloatField()
    
