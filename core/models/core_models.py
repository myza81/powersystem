import uuid
from django.apps import apps
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .utilities import OverwriteStorage, substation_sld_path
class LoadSheddingSchemeType(models.TextChoices):
    UFLS = 'UFLS', 'UFLS'
    UVLS = 'UVLS', 'UVLS'
    EMLS = 'EMLS', 'EMLS'


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
        ('Tie-Line', 'Tie-Line'),
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
        (230, '230 kV'),
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
        help_text="Upload PDF or Image SLD",
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


class LoadTransformer(models.Model):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='load_transformers')
    transformer_no = models.IntegerField()
    bay_id = models.CharField(max_length=50, unique=True, blank=True)
    hv_voltage = models.IntegerField(null=True, blank=True)
    hv_breaker_number = models.CharField(max_length=20, null=True, blank=True)
    lv_voltage = models.IntegerField(null=True, blank=True)
    lv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    capacity_mva = models.IntegerField(null=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('substation', 'transformer_no')
        verbose_name = "Load Transformer"
        verbose_name_plural = "Load Transformers"
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
    breaker_number = models.CharField(max_length=20, null=True, blank=True)
    bay_id = models.CharField(max_length=80, unique=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('substation', 'to_substation', 'ckt_id')
        ordering = ['substation__substation_id', 'to_substation__substation_id', 'ckt_id']
        verbose_name = "Incoming Branch"
        verbose_name_plural = "Incoming Branches"

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
        verbose_name = "Incoming Branch Alias"
        verbose_name_plural = "Incoming Branch Aliases"

    def __str__(self):
        return str(self.bay_id)


class AutoTransformer(models.Model):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE, related_name='auto_transformers')
    transformer_no = models.IntegerField()
    bay_id = models.CharField(max_length=50, unique=True, blank=True)
    hv_voltage = models.IntegerField(null=True, blank=True)
    hv_breaker_number = models.CharField(max_length=20, null=True, blank=True)
    lv_voltage = models.IntegerField()
    lv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    capacity_mva = models.IntegerField(null=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('substation', 'transformer_no')
        ordering = ['substation__substation_id', 'transformer_no']
        verbose_name = "Auto Transformer"
        verbose_name_plural = "Auto Transformers"

    def save(self, *args, **kwargs):
        if self.substation_id is not None and self.transformer_no is not None:
            self.bay_id = f"{self.substation_id}_AT{self.transformer_no}"
        if self.hv_voltage is None and self.substation_id is not None:
            self.hv_voltage = self.substation.voltage
        super().save(*args, **kwargs)

    def __str__(self):
        return str(self.bay_id)


class CriticalCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category_name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    class Meta:
        ordering = ['category_name']
        verbose_name = "Critical Category"
        verbose_name_plural = "Critical Categories"

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
        verbose_name = "Critical Source"
        verbose_name_plural = "Critical Sources"

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


class LoadSheddingRelay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    substation = models.ForeignKey(
        Substation,
        on_delete=models.CASCADE,
        related_name='load_shedding_relays',
    )
    load_transformers = models.ManyToManyField(
        LoadTransformer,
        related_name='load_shedding_relays',
        blank=True,
    )
    incoming_branches = models.ManyToManyField(
        IncomingBranch,
        related_name='load_shedding_relays',
        blank=True,
    )
    auto_transformers = models.ManyToManyField(
        AutoTransformer,
        related_name='load_shedding_relays',
        blank=True,
    )
    relay_name = models.CharField(max_length=100, blank=True, help_text="Optional name to distinguish multiple relays at the same site")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['substation__substation_id']
        indexes = [
            models.Index(fields=['substation']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = "Load Shedding Relay"
        verbose_name_plural = "Load Shedding Relays"

    def __str__(self):
        if self.relay_name:
            return f"{self.relay_name} @ {self.substation.substation_id}"
        return f"Relay @ {self.substation.substation_id}"


class LoadSheddingSetting(models.Model):
    """
    Threshold/delay element (UFLS/UVLS only).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme_type = models.CharField(
        max_length=10,
        choices=[
            (LoadSheddingSchemeType.UFLS, 'UFLS'),
            (LoadSheddingSchemeType.UVLS, 'UVLS'),
        ],
        default=LoadSheddingSchemeType.UFLS,
    )
    threshold = models.FloatField(help_text="Hz for UFLS; p.u. for UVLS")
    time_delay = models.FloatField(help_text="Seconds")
    label = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-threshold', 'time_delay']
        constraints = [
            models.UniqueConstraint(
                fields=['scheme_type', 'threshold', 'time_delay'],
                name='uniq_loadshedding_setting_trip',
            ),
        ]
        verbose_name = "Load Shedding Setting"
        verbose_name_plural = "Load Shedding Settings"

    def __str__(self):
        return self.label or self.build_label()

    def build_label(self):
        unit = 'Hz' if self.scheme_type == LoadSheddingSchemeType.UFLS else 'pu'
        threshold = f"{self.threshold:g}"
        time_delay = f"{self.time_delay:g}"
        return f"{threshold}{unit}_{time_delay}s"

    def save(self, *args, **kwargs):
        if not self.label:
            self.label = self.build_label()
        super().save(*args, **kwargs)


from decimal import Decimal

class LoadSheddingVersion(models.Model):
    """
    Versioned snapshot of a load shedding scheme.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('deactivated', 'Deactivated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme_type = models.CharField(max_length=10, choices=LoadSheddingSchemeType.choices)
    review_year = models.IntegerField(help_text="The year this version is for (e.g. 2024)")
    version = models.DecimalField(max_digits=5, decimal_places=1, default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_active = models.BooleanField(default=False, help_text="Whether this is the currently enforced version")
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='published_load_shedding_versions',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_load_shedding_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True, help_text="Change notes between versions")

    class Meta:
        ordering = ['-review_year', '-version']
        constraints = [
            models.UniqueConstraint(
                fields=['scheme_type', 'review_year', 'version'],
                name='uniq_version_per_year_scheme',
            ),
        ]
        verbose_name = "Load Shedding Version"
        verbose_name_plural = "Load Shedding Versions"

    def __str__(self):
        return f"{self.scheme_type} - {self.review_year} v{self.version} ({self.status})"

    def clean(self):
        if self.review_year and (self.review_year < 2000 or self.review_year > 2100):
            raise ValidationError({'review_year': 'Please enter a valid 4-digit year.'})

    def save(self, *args, **kwargs):
        if self._state.adding and not self.version:
            # Auto-assign version during creation if not already set
            existing = LoadSheddingVersion.objects.filter(
                scheme_type=self.scheme_type,
                review_year=self.review_year
            ).order_by('-version').first()
            if existing:
                self.version = existing.version + Decimal('0.1')
            else:
                self.version = Decimal('0.0')
        super().save(*args, **kwargs)

    def publish(self, user=None):
        if self.status == 'active':
            return

        self.status = 'active'
        self.published_at = timezone.now()
        if user:
            self.published_by = user
        self.is_active = True

        # Deactivate any other active versions for the same scheme_type (global rule)
        LoadSheddingVersion.objects.filter(
            scheme_type=self.scheme_type,
            is_active=True,
        ).exclude(id=self.id).update(is_active=False, status='deactivated')

        self.save()


class LoadSheddingStage(models.Model):
    """
    Stage within a load shedding version.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(LoadSheddingVersion, on_delete=models.CASCADE, related_name='stages')
    stage_number = models.IntegerField()
    label = models.CharField(max_length=20, blank=True)
    settings = models.ManyToManyField(
        LoadSheddingSetting,
        through='LoadSheddingStageSetting',
        related_name='stages',
        blank=True,  # EMLS stages have no threshold/delay settings
    )

    class Meta:
        ordering = ['version', 'stage_number']
        constraints = [
            models.UniqueConstraint(
                fields=['version', 'stage_number'],
                name='uniq_stage_per_version'
            ),
        ]
        verbose_name = "Load Shedding Stage"
        verbose_name_plural = "Load Shedding Stages"

    def __str__(self):
        return f"{self.label}" if self.label else f"Stage {self.stage_number}"

    def save(self, *args, **kwargs):
        if not self.label and self.stage_number is not None:
            self.label = f"Stage {self.stage_number}"
        super().save(*args, **kwargs)

    def clean(self):
        """
        Enforce that UFLS/UVLS stages must have at least one setting.
        EMLS stages are exempt — they use bay mappings without threshold/delay settings.
        """
        if self._state.adding:
            return  # M2M can't be queried before the instance is saved; enforced via admin formset
        try:
            scheme_type = self.version.scheme_type
        except Exception:
            return
        if scheme_type != LoadSheddingSchemeType.EMLS:
            if not self.settings.exists():
                raise ValidationError("At least one setting is required for UFLS/UVLS stages.")


class LoadSheddingStageSetting(models.Model):
    stage = models.ForeignKey(LoadSheddingStage, on_delete=models.CASCADE)
    setting = models.ForeignKey(LoadSheddingSetting, on_delete=models.CASCADE)
    version = models.ForeignKey(LoadSheddingVersion, on_delete=models.CASCADE)

    class Meta:
        unique_together = (
            ('version', 'setting'),  # A setting can only appear once per version
            ('stage', 'setting'),    # And only once per stage
        )
        verbose_name = "Load Shedding Stage Setting"
        verbose_name_plural = "Load Shedding Stage Settings"

    def save(self, *args, **kwargs):
        if self.stage_id and not self.version_id:
            self.version_id = self.stage.version_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.setting}"


class LoadSheddingTransformerBay(models.Model):
    """
    Local load at a substation's transformers.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stage = models.ForeignKey(LoadSheddingStage, on_delete=models.CASCADE, related_name='transformer_bays')
    relay = models.ForeignKey(LoadSheddingRelay, on_delete=models.CASCADE, related_name='target_transformer_bays')
    transformers = models.ManyToManyField(LoadTransformer, related_name='load_shedding_transformer_bays')
    mw_cache = models.JSONField(null=True, blank=True, help_text='{"snapshot_id": "...", "mw": 18.4, "computed_at": "..."}')

    def __str__(self):
        return f"TX Bay @ {self.relay.substation.substation_id} ({self.stage})"

    def clean(self):
        """
        Validates that selected transformers belong to the relay's substation.
        For new objects (no pk yet), M2M cannot be queried — this is enforced
        by the admin form's clean() instead.
        """
        if not self.relay_id or not self.pk:
            return
        allowed_ids = set(self.relay.load_transformers.values_list('id', flat=True))
        selected_ids = set(self.transformers.values_list('id', flat=True))
        if selected_ids and not selected_ids.issubset(allowed_ids):
            raise ValidationError("Selected transformers must belong to the relay's load transformers.")

    def compute_mw(self, snapshot):
        from services.topology_service import TopologyService

        service = TopologyService(snapshot)
        load_map = service.get_load_transformers_by_substation()
        substation_id = self.relay.substation.substation_id
        loads = load_map.get(substation_id, {}).get("loads", [])

        target_ids = set(self.transformers.values_list('bay_id', flat=True))
        total_mw = 0.0
        for load in loads:
            if load.get("load_id") in target_ids:
                total_mw += float(load.get("p_mw") or 0.0)

        self.mw_cache = {
            "snapshot_id": str(snapshot.id),
            "mw": total_mw,
            "computed_at": timezone.now().isoformat(),
        }
        self.save(update_fields=['mw_cache'])
        return total_mw

    def get_mw(self, snapshot):
        if not self.mw_cache or self.mw_cache.get('snapshot_id') != str(snapshot.id):
            return self.compute_mw(snapshot)
        return float(self.mw_cache.get('mw', 0.0))
    
    class Meta:
        unique_together = ('stage', 'relay')  # One transformer bay per relay per stage
        verbose_name = "Load Shedding Transformer Bay"
        verbose_name_plural = "Load Shedding Transformer Bays"




class LoadSheddingPocketBay(models.Model):
    """
    Network pocket isolation with boundary relay/branch validation.
    Used by UFLS, UVLS, and EMLS stages.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stage = models.ForeignKey(LoadSheddingStage, on_delete=models.CASCADE, related_name='pocket_bays')
    topology_cache = models.JSONField(
        null=True, blank=True,
        help_text='{"snapshot_id": "...", "isolated_substations": [], "mw": 34.7, "computed_at": "..."}'
    )
    topology_valid = models.BooleanField(default=True)
    topology_alert = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = "Load Shedding Pocket Bay"
        verbose_name_plural = "Load Shedding Pocket Bays"

    def clean(self):
        # Validation is now handled at the boundary level and admin formset level
        pass

    def __str__(self):
        return f"Pocket Bay ({self.stage})"

    def _build_cuts(self):
        """
        Translate boundary_branches into cut-dicts for compute_island().
        Groups circuits by (from_sub, to_sub) pair so all parallel circuits
        between the same pair are opened together in one cut.
        """
        from collections import defaultdict
        grouped = defaultdict(list)
        
        # Iterate over all branches across all boundaries
        for boundary in self.boundaries.prefetch_related('branches__substation', 'branches__to_substation').all():
            for branch in boundary.branches.all():
                key = (branch.substation.substation_id, branch.to_substation.substation_id)
                grouped[key].append(branch.ckt_id)

        cuts = []
        for (from_sub, to_sub), ckt_ids in grouped.items():
            cuts.append({
                "from_substation_id": from_sub,
                "to_substation_id": to_sub,
                "circuit_ids": ckt_ids,
                "link_type": "branch",
                "isolation_scope": "between",
            })
        return cuts

    def compute_topology(self, snapshot):
        """
        1. Validates each boundary branch exists in the active TopologyBranch
           for the snapshot's topology version (by substation→bus pair + ckt_id).
        2. Calls compute_island(all_cuts) to find the isolated pocket.
        3. Validates the pocket is non-empty.
        4. Calls compute_load_totals() to sum the shed MW.
        5. Writes topology_cache, topology_valid, topology_alert.
        """
        from services.topology_service import TopologyService
        from core.models import TopologyBranch

        alerts = []

        # --- Validation 1: check each boundary branch exists in active topology ---
        valid_branches = []
        for boundary in self.boundaries.prefetch_related('branches__substation', 'branches__to_substation').all():
            for branch in boundary.branches.all():
                from_sub = branch.substation.substation_id
                to_sub = branch.to_substation.substation_id
                ckt_id = branch.ckt_id

                # TopologyBranch connects buses; we match via the bus→substation mapping
                exists = TopologyBranch.objects.filter(
                    topology_version=snapshot.topology_version,
                    ckt_id=ckt_id,
                    from_bus__substation__substation_id=from_sub,
                    to_bus__substation__substation_id=to_sub,
                ).union(
                    TopologyBranch.objects.filter(
                        topology_version=snapshot.topology_version,
                        ckt_id=ckt_id,
                        from_bus__substation__substation_id=to_sub,
                        to_bus__substation__substation_id=from_sub,
                    )
                ).exists()

                if not exists:
                    alerts.append(
                        f"Pocket invalid: {from_sub}–{to_sub} Ckt {ckt_id} "
                        f"no longer present in active topology."
                    )
                else:
                    valid_branches.append(branch)

        # --- Validation 2: compute island from all cuts (even partial) ---
        service = TopologyService(snapshot)
        cuts = self._build_cuts()  # built from all boundary branches (including missing ones)g ones)
        isolated_substations = service.compute_island(cuts) if cuts else []

        if not isolated_substations:
            # Identify which branch might be the culprit (first branch pair as hint)
            hint = ""
            if valid_branches:
                b = valid_branches[0]
                hint = f" Verify boundary branch at {b.substation.substation_id}."
            elif cuts:
                hint = f" Verify boundary branch at {cuts[0]['from_substation_id']}."
            alerts.append(
                f"Pocket invalid: Boundary cuts are insufficient — "
                f"no substations isolated.{hint}"
            )

        totals = service.compute_load_totals(isolated_substations) if isolated_substations else {
            "isolated_total_p_mw": 0.0,
        }

        self.topology_cache = {
            "snapshot_id": str(snapshot.id),
            "isolated_substations": isolated_substations,
            "mw": totals["isolated_total_p_mw"],
            "computed_at": timezone.now().isoformat(),
        }
        self.topology_valid = len(alerts) == 0
        self.topology_alert = "; ".join(alerts) if alerts else None
        self.save(update_fields=['topology_cache', 'topology_valid', 'topology_alert'])
        return self.topology_cache


    def get_mw(self, snapshot):
        if not self.topology_cache or self.topology_cache.get('snapshot_id') != str(snapshot.id):
            cache = self.compute_topology(snapshot)
            return float(cache.get('mw', 0.0))
        return float(self.topology_cache.get('mw', 0.0))


class LoadSheddingPocketBoundary(models.Model):
    """
    Defines one 'edge' of a pocket (a Relay and its corresponding Branches).
    A Pocket Bay consists of multiple boundaries (e.g., from multiple substations).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pocket = models.ForeignKey(LoadSheddingPocketBay, on_delete=models.CASCADE, related_name='boundaries')
    relay = models.ForeignKey(LoadSheddingRelay, on_delete=models.CASCADE, related_name='target_pocket_boundaries')
    branches = models.ManyToManyField(IncomingBranch, related_name='load_shedding_pocket_boundaries')

    class Meta:
        verbose_name = "Load Shedding Pocket Boundary"
        verbose_name_plural = "Load Shedding Pocket Boundaries"

    def clean(self):
        """
        Validate that the chosen branches actually belong to the chosen relay.
        Note: For new objects, M2M fields aren't saved yet, so this validation
        is handled by the admin formset's clean() as well.
        """
        if not self.relay_id or not self.pk:
            return
        allowed_ids = set(self.relay.incoming_branches.values_list('id', flat=True))
        selected_ids = set(self.branches.values_list('id', flat=True))
        if selected_ids and not selected_ids.issubset(allowed_ids):
            raise ValidationError("Selected branches must belong to the relay's incoming branches.")

    def __str__(self):
        return f"Boundary @ {self.relay.substation.substation_id} for Pocket ({self.pocket})"
