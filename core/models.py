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
            # Use Django's path resolution to prevent path traversal.
            existing_path = self.path(name)
            try:
                os.remove(existing_path)
            except FileNotFoundError:
                pass
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
        if kwargs.get("raw"):
            return super().save(*args, **kwargs)
        # 1. Automated Region derivation from grid
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
        
        # 2. Automated Tiered State Detection
        # Only detect if coordinates exist and (record is new OR coords changed OR state is missing)
        if self.latitude and self.longitude:
            should_detect = False
            if not self.pk:
                should_detect = True
            else:
                try:
                    old = Substation.objects.get(pk=self.pk)
                    # Compare as strings to handle Decimal conversion safely
                    if (str(old.latitude) != str(self.latitude) or 
                        str(old.longitude) != str(self.longitude) or 
                        not self.state):
                        should_detect = True
                except Substation.DoesNotExist:
                    should_detect = True
            
            if should_detect:
                from services.geocoding import GeocodingService
                from core.utils.geo import get_state_from_coordinates
                
                # Tier 1 & 2: External APIs (OSM -> Google)
                # Note: This is request-blocking but capped at 3s timeout per service
                detected_state = GeocodingService.reverse_geocode(self.latitude, self.longitude)
                
                # Tier 3: Local Fallback (Grid Hints + Geometry)
                if not detected_state:
                    detected_state = get_state_from_coordinates(self.latitude, self.longitude, grid=self.grid)
                
                if detected_state:
                    self.state = detected_state
        
        # 3. Ensure sld filename consistency
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
    
    # Ownership
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='snapshots',
        help_text="User who uploaded this snapshot"
    )
    
    # System parameters from Case Identification
    base_mva = models.FloatField(default=100.0)
    frequency = models.FloatField(default=50.0)
    
    # File tracking
    source_file = models.FileField(upload_to='snapshots/', null=True, blank=True)

    # Active selection
    is_active = models.BooleanField(default=False)
    activated_at = models.DateTimeField(null=True, blank=True)
    
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
    
    # Classification
    bus_type = models.IntegerField(default=1, help_text="PSS/E IDE Code (1=Load, 2=Gen, 3=Swing, 4=Isolated)")
    
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
    This model handles both the 2-winding and 3-winding record formats.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='transformers')
    from_bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='transformers_from')
    to_bus = models.ForeignKey(NetworkBus, on_delete=models.CASCADE, related_name='transformers_to')
    tertiary_bus = models.ForeignKey(
        NetworkBus, on_delete=models.CASCADE, 
        related_name='transformers_tertiary', null=True, blank=True
    )
    
    ckt_id = models.CharField(max_length=2, default='1')
    
    # Parameters
    r = models.FloatField(default=0.0)
    x = models.FloatField()
    primary_winding = models.IntegerField(default=1) # 1=from, 2=to
    
    # Winding Information (PSS/E Reference)
    windv1 = models.FloatField(default=1.0, help_text="Winding 1 ratio/voltage")
    windv2 = models.FloatField(default=1.0, help_text="Winding 2 ratio/voltage")
    windv3 = models.FloatField(null=True, blank=True, help_text="Winding 3 ratio/voltage")
    
    nomv1 = models.FloatField(default=0.0, help_text="Winding 1 nominal voltage (kV)")
    nomv2 = models.FloatField(default=0.0, help_text="Winding 2 nominal voltage (kV)")
    nomv3 = models.FloatField(null=True, blank=True, help_text="Winding 3 nominal voltage (kV)")

    # Ratings
    rate_a = models.FloatField(default=0.0)
    
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['snapshot', 'from_bus', 'to_bus'])]

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



# ===========================================================================
# 8. PROTECTION RELAY REGISTRY
# ===========================================================================

class ProtectionRelay(models.Model):
    """
    One row = one relay wired to one circuit. Captures both the relay panel
    identity and what it trips. As a system protection engineer, this is the
    primary record: 'UFLS-01 at BRGS132 trips feeder BRGS132-MGST132 Cct 1'.
    """
    RELAY_TYPE_CHOICES = [
        ('UFLS', 'Under-Frequency Load Shedding (UFLS)'),
        ('UVLS', 'Under-Voltage Load Shedding (UVLS)'),
    ]
    ASSIGNMENT_TYPE_CHOICES = [
        ('branch', 'Branch (Feeder / Interconnector)'),
        ('load_transformer', 'Load Transformer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    relay_type = models.CharField(max_length=10, choices=RELAY_TYPE_CHOICES)
    relay_panel_id = models.CharField(
        max_length=30, blank=True, null=True,
        help_text="Panel label, e.g. 'UFLS-01'. Optional if not recorded.",
    )
    substation = models.ForeignKey(
        Substation,
        on_delete=models.CASCADE,
        related_name='protection_relays',
        help_text="Substation where this relay panel is installed",
    )
    # What it trips
    assignment_type = models.CharField(max_length=20, choices=ASSIGNMENT_TYPE_CHOICES)
    from_substation_id = models.CharField(
        max_length=20,
        help_text="Sending-end substation ID, e.g. 'BRGS132'",
    )
    to_substation_id = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="Remote-end substation ID (branch only), e.g. 'MGST132'",
    )
    circuit_id = models.CharField(
        max_length=10,
        help_text="e.g. '1', '2' for feeders; 'T1', 'T2' for transformers",
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['substation__substation_id', 'relay_type', 'relay_panel_id']
        verbose_name = 'Protection Relay'
        verbose_name_plural = 'Protection Relays'

    def __str__(self):
        panel = self.relay_panel_id or ''
        if self.assignment_type == 'branch':
            return f"{self.relay_type} {panel} @ {self.substation_id} → {self.from_substation_id}-{self.to_substation_id} Cct{self.circuit_id}"
        return f"{self.relay_type} {panel} @ {self.substation_id} → {self.from_substation_id} {self.circuit_id}"


# ===========================================================================
# 9. LOAD SHEDDING SCHEMES
# ===========================================================================

class LoadSheddingScheme(models.Model):
    """
    Top-level definition for a scheme type. Unique per scheme_type.
    """
    SCHEME_TYPE_CHOICES = [
        ('UFLS', 'Under-Frequency Load Shedding (UFLS)'),
        ('UVLS', 'Under-Voltage Load Shedding (UVLS)'),
        ('MANUAL', 'Manual Load Shedding'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme_type = models.CharField(max_length=10, choices=SCHEME_TYPE_CHOICES, unique=True)
    name = models.CharField(max_length=100, help_text='e.g. "National UFLS Scheme"')
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_schemes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheme_type']

    def __str__(self):
        return f"{self.scheme_type} — {self.name}"


class SchemeVersion(models.Model):
    """
    Versioned revision of a LoadSheddingScheme.
    One version per scheme can be 'active' at any time.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('superseded', 'Superseded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme = models.ForeignKey(
        LoadSheddingScheme,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.CharField(max_length=20, help_text="e.g. '2024', 'Rev 3', 'v2.1'")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='draft')
    effective_date = models.DateField(blank=True, null=True)
    published_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='published_versions',
    )
    published_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.scheme} v{self.version_number} [{self.status}]"

    def publish(self, user=None):
        """Set this version active, supersede all previous active versions."""
        from django.utils import timezone
        if self.status not in ('draft',):
            raise ValueError(f"Cannot publish a version with status '{self.status}'.")
        SchemeVersion.objects.filter(
            scheme=self.scheme, status='active'
        ).update(status='superseded')
        self.status = 'active'
        self.published_by = user
        self.published_at = timezone.now()
        self.save()


class ShedGroupSetting(models.Model):
    """
    A priority trip group within a SchemeVersion.
    order=1 is shed first.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        SchemeVersion,
        on_delete=models.CASCADE,
        related_name='groups',
    )
    name = models.CharField(max_length=50, help_text="e.g. 'Group 1', 'Stage A'")
    operating_stage = models.PositiveSmallIntegerField(help_text="Stage number; 1 = shed first")

    # Dual setpoints: primary and backup relay
    trigger_setpoint1 = models.FloatField(
        null=True, blank=True,
        help_text="Primary setpoint: Hz for UFLS, pu voltage for UVLS",
    )
    trigger_delay1 = models.FloatField(null=True, blank=True, help_text="Primary relay delay (seconds)")
    trigger_setpoint2 = models.FloatField(null=True, blank=True, help_text="Backup/secondary setpoint")
    trigger_delay2 = models.FloatField(null=True, blank=True, help_text="Backup relay delay (seconds)")

    target_mw_shed = models.FloatField(null=True, blank=True, help_text="Planned MW quantum")
    include_autotransformers = models.BooleanField(default=True)

    class Meta:
        unique_together = [('version', 'operating_stage')]
        ordering = ['version', 'operating_stage']

    def __str__(self):
        return f"{self.version} › {self.name} (stage {self.operating_stage})"

class ShedGroupAssignment(models.Model):
    """
    A single circuit assigned to a ShedGroupSetting.
    substation FK is auto-resolved from from_substation_id on save().
    """
    ASSIGNMENT_TYPE_CHOICES = [
        ('branch', 'Branch (Feeder / Interconnector)'),
        ('load_transformer', 'Load Transformer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        ShedGroupSetting,
        on_delete=models.CASCADE,
        related_name='assignments',
    )
    assignment_type = models.CharField(max_length=20, choices=ASSIGNMENT_TYPE_CHOICES)

    # String IDs (source of truth)
    from_substation_id = models.CharField(
        max_length=20,
        help_text="Substation ID string, e.g. 'BRGS132'",
    )
    to_substation_id = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="Remote substation ID (branch only), e.g. 'MGST132'",
    )
    circuit_id = models.CharField(
        max_length=10,
        help_text="e.g. '1', '2' for branches; 'T1', 'T2' for load transformers",
    )
    note = models.TextField(blank=True, null=True)
    # FK auto-resolved from from_substation_id
    substation = models.ForeignKey(
        Substation,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='shed_assignments',
        help_text="Auto-resolved from from_substation_id",
    )

    class Meta:
        ordering = ['group', 'assignment_type', 'from_substation_id']

    def save(self, *args, **kwargs):
        # Auto-resolve substation FK
        if self.from_substation_id and not self.substation_id:
            try:
                self.substation = Substation.objects.get(substation_id=self.from_substation_id)
            except Substation.DoesNotExist:
                self.substation = None
        super().save(*args, **kwargs)

    def __str__(self):
        if self.assignment_type == 'branch':
            return f"{self.from_substation_id} - {self.to_substation_id} {self.circuit_id}"
        return f"{self.from_substation_id} {self.circuit_id}"
