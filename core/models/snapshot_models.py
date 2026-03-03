import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q

from .core_models import Substation, LoadTransformer, IncomingBranch, AutoTransformer


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
        help_text="User who uploaded this snapshot",
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


class NetworkTopology(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, default='National Topology')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = "Network Topology"
        verbose_name_plural = "Network Topologies"

    def __str__(self):
        return self.name


class TopologyVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topology = models.ForeignKey(NetworkTopology, on_delete=models.CASCADE, related_name='versions')
    version_tag = models.CharField(max_length=50)
    signature = models.CharField(max_length=64, unique=True)
    created_from_snapshot = models.ForeignKey(
        NetworkSnapshot, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_topology_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Topology Version"
        verbose_name_plural = "Topology Versions"

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
        help_text="Linked Master Substation",
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
        verbose_name = "Topology Bus"
        verbose_name_plural = "Topology Buses"

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
        verbose_name = "Topology Branch"
        verbose_name_plural = "Topology Branches"


class TopologyTransformer(models.Model):
    """
    2-Winding or 3-Winding Transformer (topology-only).
    """
    topology_version = models.ForeignKey(TopologyVersion, on_delete=models.CASCADE, related_name='transformers')
    from_bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='transformers_from')
    to_bus = models.ForeignKey(TopologyBus, on_delete=models.CASCADE, related_name='transformers_to')
    tertiary_bus = models.ForeignKey(
        TopologyBus, on_delete=models.CASCADE,
        related_name='transformers_tertiary', null=True, blank=True,
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
        verbose_name = "Topology Transformer"
        verbose_name_plural = "Topology Transformers"


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
                name='equipment_map_master_xor',
            ),
            models.CheckConstraint(
                condition=(
                    (Q(topology_transformer__isnull=False) & Q(topology_branch__isnull=True)) |
                    (Q(topology_transformer__isnull=True) & Q(topology_branch__isnull=False))
                ),
                name='equipment_map_topology_xor',
            ),
            models.UniqueConstraint(fields=['topology_version', 'equipment_type', 'load_transformer'], name='uniq_map_load_transformer'),
            models.UniqueConstraint(fields=['topology_version', 'equipment_type', 'incoming_branch'], name='uniq_map_incoming_branch'),
            models.UniqueConstraint(fields=['topology_version', 'equipment_type', 'auto_transformer'], name='uniq_map_auto_transformer'),
        ]
        verbose_name = "Equipment Topology Map"
        verbose_name_plural = "Equipment Topology Maps"


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
                name='equipment_state_master_xor',
            ),
        ]
        verbose_name = "Equipment Snapshot State"
        verbose_name_plural = "Equipment Snapshot States"


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
        verbose_name = "Snapshot Bus State"
        verbose_name_plural = "Snapshot Bus States"


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

    class Meta:
        unique_together = ('snapshot', 'bus', 'load_id')
        indexes = [
            models.Index(fields=['snapshot', 'bus', 'load_id']),
        ]
        verbose_name = "Network Load"
        verbose_name_plural = "Network Loads"


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

    class Meta:
        verbose_name = "Network Generator"
        verbose_name_plural = "Network Generators"


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

    class Meta:
        verbose_name = "Network Shunt"
        verbose_name_plural = "Network Shunts"


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

    in_service = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Network Shunt"
        verbose_name_plural = "Network Shunts"


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

    in_service = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Network DC Link"
        verbose_name_plural = "Network DC Links"
