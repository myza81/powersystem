import uuid
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.core.exceptions import ValidationError
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
# 2.1 BAY MASTER DATA (Substation-Scoped)
# ==========================================

class LoadTransformer(models.Model):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='load_transformers')
    transformer_no = models.IntegerField()
    bay_id = models.CharField(max_length=50, unique=True, blank=True)
    hv_voltage = models.IntegerField(null=True, blank=True)
    hv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    lv_voltage = models.IntegerField(null=True, blank=True)
    lv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    capacity_mva = models.IntegerField(null=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('substation', 'transformer_no')
        ordering = ['substation__substation_id', 'transformer_no']

    def save(self, *args, **kwargs):
        if self.substation_id is not None and self.transformer_no is not None:
            self.bay_id = f"{self.substation_id}_T{self.transformer_no}"
        
        if self.hv_voltage is None and self.substation_id is not None:
            self.hv_voltage = self.substation.voltage
            
        if self.transformer_no is not None:
            # Auto-populate HV Breaker Number (132kV)
            if self.hv_voltage == 132 and not self.hv_breaker_number:
                self.hv_breaker_number = f"{self.transformer_no}10"
            
            # Auto-populate LV Breaker Number
            if self.lv_voltage is not None and not self.lv_breaker_number:
                if self.lv_voltage in (33, 22):
                    self.lv_breaker_number = f"{self.transformer_no}T0"
                elif self.lv_voltage == 11:
                    self.lv_breaker_number = f"3{self.transformer_no}"
                    
        super().save(*args, **kwargs)

    def __str__(self):
        return str(self.bay_id)


class IncomingBranch(models.Model):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='incoming_branches')
    to_substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='incoming_from_branches')
    ckt_id = models.CharField(max_length=2)
    breaker_number = models.CharField(max_length=10, null=True, blank=True)
    bay_id = models.CharField(max_length=80, unique=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('substation', 'to_substation', 'ckt_id')
        ordering = ['substation__substation_id', 'to_substation__substation_id', 'ckt_id']

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        previous_bay_id = None
        if not is_new:
            try:
                previous_bay_id = IncomingBranch.objects.values_list('bay_id', flat=True).get(pk=self.pk)
            except IncomingBranch.DoesNotExist:
                previous_bay_id = None
        if self.substation_id and self.to_substation_id and self.ckt_id:
            self.bay_id = f"{self.substation_id}_{self.to_substation_id}_{self.ckt_id}"
        super().save(*args, **kwargs)
        if is_new:
            effective_from = self.commissioning_date or timezone.now().date()
            IncomingBranchAlias.objects.create(
                incoming_branch=self,
                bay_id=self.bay_id,
                effective_from=effective_from,
            )
            return
        if previous_bay_id and previous_bay_id != self.bay_id:
            IncomingBranchAlias.objects.filter(
                incoming_branch=self,
                bay_id=previous_bay_id,
                effective_to__isnull=True,
            ).update(effective_to=timezone.now().date())
            IncomingBranchAlias.objects.create(
                incoming_branch=self,
                bay_id=self.bay_id,
                effective_from=timezone.now().date(),
            )

    def __str__(self):
        return str(self.bay_id)


class IncomingBranchAlias(models.Model):
    incoming_branch = models.ForeignKey(IncomingBranch, on_delete=models.CASCADE, related_name='aliases')
    bay_id = models.CharField(max_length=80, unique=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['-effective_from']

    def __str__(self):
        return str(self.bay_id)


class AutoTransformer(models.Model):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='auto_transformers')
    transformer_no = models.IntegerField()
    bay_id = models.CharField(max_length=50, unique=True, blank=True)
    hv_voltage = models.IntegerField(null=True, blank=True)
    hv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    lv_voltage = models.IntegerField()
    lv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    capacity_mva = models.IntegerField(null=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('substation', 'transformer_no')
        ordering = ['substation__substation_id', 'transformer_no']

    def save(self, *args, **kwargs):
        if self.substation_id is not None and self.transformer_no is not None:
            self.bay_id = f"{self.substation_id}_AT{self.transformer_no}"
        if self.hv_voltage is None and self.substation_id is not None:
            self.hv_voltage = self.substation.voltage
        super().save(*args, **kwargs)

    def __str__(self):
        return str(self.bay_id)


class EquipmentTopologyMap(models.Model):
    class EquipmentType(models.TextChoices):
        LOAD_TRANSFORMER = 'load_transformer', 'Load Transformer'
        INCOMING_BRANCH = 'incoming_branch', 'Incoming Branch'
        AUTO_TRANSFORMER = 'auto_transformer', 'Auto Transformer'

    topology_version = models.ForeignKey('TopologyVersion', on_delete=models.CASCADE, related_name='equipment_maps')
    equipment_type = models.CharField(max_length=30, choices=EquipmentType.choices)

    load_transformer = models.ForeignKey(LoadTransformer, on_delete=models.CASCADE, null=True, blank=True)
    incoming_branch = models.ForeignKey(IncomingBranch, on_delete=models.CASCADE, null=True, blank=True)
    auto_transformer = models.ForeignKey(AutoTransformer, on_delete=models.CASCADE, null=True, blank=True)

    topology_transformer = models.ForeignKey('TopologyTransformer', on_delete=models.CASCADE, null=True, blank=True)
    topology_branch = models.ForeignKey('TopologyBranch', on_delete=models.CASCADE, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(load_transformer__isnull=False) & Q(incoming_branch__isnull=True) & Q(auto_transformer__isnull=True)) |
                    (Q(load_transformer__isnull=True) & Q(incoming_branch__isnull=False) & Q(auto_transformer__isnull=True)) |
                    (Q(load_transformer__isnull=True) & Q(incoming_branch__isnull=True) & Q(auto_transformer__isnull=False))
                ),
                name='equipment_map_master_xor'
            ),
            models.CheckConstraint(
                condition=(
                    (Q(topology_transformer__isnull=False) & Q(topology_branch__isnull=True)) |
                    (Q(topology_transformer__isnull=True) & Q(topology_branch__isnull=False))
                ),
                name='equipment_map_topology_xor'
            ),
            models.UniqueConstraint(fields=['topology_version', 'equipment_type', 'load_transformer'], name='uniq_map_load_transformer'),
            models.UniqueConstraint(fields=['topology_version', 'equipment_type', 'incoming_branch'], name='uniq_map_incoming_branch'),
            models.UniqueConstraint(fields=['topology_version', 'equipment_type', 'auto_transformer'], name='uniq_map_auto_transformer'),
        ]


class EquipmentSnapshotState(models.Model):
    class EquipmentType(models.TextChoices):
        LOAD_TRANSFORMER = 'load_transformer', 'Load Transformer'
        INCOMING_BRANCH = 'incoming_branch', 'Incoming Branch'
        AUTO_TRANSFORMER = 'auto_transformer', 'Auto Transformer'

    snapshot = models.ForeignKey('NetworkSnapshot', on_delete=models.CASCADE, related_name='equipment_states')
    equipment_type = models.CharField(max_length=30, choices=EquipmentType.choices)

    load_transformer = models.ForeignKey(LoadTransformer, on_delete=models.CASCADE, null=True, blank=True)
    incoming_branch = models.ForeignKey(IncomingBranch, on_delete=models.CASCADE, null=True, blank=True)
    auto_transformer = models.ForeignKey(AutoTransformer, on_delete=models.CASCADE, null=True, blank=True)

    in_service = models.BooleanField(default=True)
    state_source = models.CharField(max_length=20, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(load_transformer__isnull=False) & Q(incoming_branch__isnull=True) & Q(auto_transformer__isnull=True)) |
                    (Q(load_transformer__isnull=True) & Q(incoming_branch__isnull=False) & Q(auto_transformer__isnull=True)) |
                    (Q(load_transformer__isnull=True) & Q(incoming_branch__isnull=True) & Q(auto_transformer__isnull=False))
                ),
                name='equipment_state_master_xor'
            )
        ]

# ==========================================
# 2.2 CRITICAL ASSET MASTER DATA    
# ==========================================

class CriticalCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category_name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)


    class Meta:
        ordering = ['category_name']

    def save(self, *args, **kwargs):
        if not self.slug and self.category_name:
            self.slug = self.category_name.lower().replace(' ', '_')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.category_name


class CriticalSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_file = models.FileField(upload_to='critical_sources/', blank=True)
    issued_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['-issued_date']

    def __str__(self):
        import os
        return os.path.basename(self.source_file.name) if self.source_file else str(self.id)

    def clean(self):
        if self.source_file and not self.source_file.name.lower().endswith('.pdf'):
            raise ValidationError({'source_file': 'Only PDF files are allowed.'})


class CriticalAsset(models.Model):
    SENSITIVITY_CHOICES = [
        (1, 'Low'),
        (2, 'Medium'),
        (3, 'High'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.CharField(max_length=50)
    category = models.ForeignKey(CriticalCategory, on_delete=models.CASCADE, related_name='assets')
    sensitivity_impact = models.IntegerField(choices=SENSITIVITY_CHOICES, null=True, blank=True)
    source = models.ForeignKey(CriticalSource, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    notes = models.TextField(blank=True)
    is_inforce = models.BooleanField(default=True)
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='critical_assets', null=True)
    load_transformers = models.ManyToManyField(LoadTransformer, related_name='critical_assets', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.asset} ({self.category.category_name})"



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

    IMPORT_TYPE_CHOICES = [
        ('RAW_FULL', 'Full RAW Import'),
        ('LOAD_PROFILE_ONLY', 'Load Profile Only'),
    ]
    import_type = models.CharField(
        max_length=30,
        choices=IMPORT_TYPE_CHOICES,
        default='RAW_FULL',
    )

    # Topology linkage (global, versioned)
    topology_version = models.ForeignKey(
        'TopologyVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='snapshots',
    )
    
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
# 5. GLOBAL TOPOLOGY (Versioned)
# ==========================================

class NetworkTopology(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, default='National Topology')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.name


class TopologyVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topology = models.ForeignKey(NetworkTopology, on_delete=models.CASCADE, related_name='versions')
    version_tag = models.CharField(max_length=50)
    signature = models.CharField(max_length=64, unique=True)
    created_from_snapshot = models.ForeignKey(
        NetworkSnapshot, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_topology_versions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.topology.name} {self.version_tag}"


class TopologyBus(models.Model):
    """
    Immutable topology node for a given TopologyVersion.
    """
    topology_version = models.ForeignKey(TopologyVersion, on_delete=models.CASCADE, related_name='buses')

    substation = models.ForeignKey(
        Substation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='topology_buses',
        help_text="Linked Master Substation"
    )

    bus_number = models.IntegerField(db_index=True)
    bus_name = models.CharField(max_length=20)
    base_kv = models.FloatField(db_index=True)

    psse_area = models.IntegerField(null=True, blank=True)
    psse_zone = models.IntegerField(null=True, blank=True)
    psse_owner = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('topology_version', 'bus_number')
        indexes = [
            models.Index(fields=['topology_version', 'bus_number']),
            models.Index(fields=['topology_version', 'substation']),
        ]

    def __str__(self):
        return f"{self.bus_number} {self.bus_name}"


class TopologyBranch(models.Model):
    """
    AC Transmission Line or Cable (topology-only).
    """
    topology_version = models.ForeignKey(TopologyVersion, on_delete=models.CASCADE, related_name='branches')
    from_bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='branches_from')
    to_bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='branches_to')
    ckt_id = models.CharField(max_length=2, default='1')

    r = models.FloatField(help_text="Resistance (pu)")
    x = models.FloatField(help_text="Reactance (pu)")
    b = models.FloatField(help_text="Charging (pu)")

    rate_a = models.FloatField(default=0.0)
    rate_b = models.FloatField(default=0.0)
    rate_c = models.FloatField(default=0.0)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['topology_version', 'from_bus', 'to_bus'])]


class TopologyTransformer(models.Model):
    """
    2-Winding or 3-Winding Transformer (topology-only).
    """
    topology_version = models.ForeignKey(TopologyVersion, on_delete=models.CASCADE, related_name='transformers')
    from_bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='transformers_from')
    to_bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='transformers_to')
    tertiary_bus = models.ForeignKey(
        TopologyBus, on_delete=models.CASCADE,
        related_name='transformers_tertiary', null=True, blank=True
    )

    ckt_id = models.CharField(max_length=2, default='1')

    r = models.FloatField(default=0.0)
    x = models.FloatField()
    primary_winding = models.IntegerField(default=1)

    windv1 = models.FloatField(default=1.0)
    windv2 = models.FloatField(default=1.0)
    windv3 = models.FloatField(null=True, blank=True)

    nomv1 = models.FloatField(default=0.0)
    nomv2 = models.FloatField(default=0.0)
    nomv3 = models.FloatField(null=True, blank=True)

    rate_a = models.FloatField(default=0.0)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['topology_version', 'from_bus', 'to_bus'])]


class SnapshotBusState(models.Model):
    """
    Snapshot-specific bus state (voltage, type, limits).
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='bus_states')
    bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='states')

    bus_type = models.IntegerField(default=1, help_text="PSS/E IDE Code (1=Load, 2=Gen, 3=Swing, 4=Isolated)")
    voltage_mag = models.FloatField(help_text="Voltage Magnitude (pu)")
    voltage_angle = models.FloatField(help_text="Voltage Angle (degrees)")

    nv_hi = models.FloatField(null=True, blank=True)
    nv_lo = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ('snapshot', 'bus')
        indexes = [
            models.Index(fields=['snapshot', 'bus']),
        ]

class NetworkLoad(models.Model):
    """
    Power consumption at a bus.
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='loads')
    bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='loads')
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
    bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='generators')
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
    bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='shunts')
    shunt_id = models.CharField(max_length=2)
    
    g_mw = models.FloatField(help_text="Shunt Conductance")
    b_mvar = models.FloatField(help_text="Shunt Susceptance")
    
    in_service = models.BooleanField(default=True)

class NetworkSwitchedShunt(models.Model):
    """
    Switched Shunt (SVC, Capacitor Bank with steps).
    """
    snapshot = models.ForeignKey(NetworkSnapshot, on_delete=models.CASCADE, related_name='switched_shunts')
    bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='switched_shunts')
    
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
