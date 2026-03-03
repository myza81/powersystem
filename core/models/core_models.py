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
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['substation']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = "Load Shedding Relay"
        verbose_name_plural = "Load Shedding Relays"

    def __str__(self):
        return str(self.id)


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

    class Meta:
        ordering = ['scheme_type', 'threshold', 'time_delay']
        unique_together = ('scheme_type', 'threshold', 'time_delay')
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


class LoadSheddingVersion(models.Model):
    """
    Load shedding version containing stages.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme_type = models.CharField(max_length=10, choices=LoadSheddingSchemeType.choices)
    version_label = models.CharField(max_length=50, help_text="e.g. '2024-v1', '2025-draft'")

    class Meta:
        ordering = ['version_label']
        verbose_name = "Load Shedding Version"
        verbose_name_plural = "Load Shedding Versions"

    def __str__(self):
        return f"{self.scheme_type} - {self.version_label}"


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
        blank=True,
    )

    class Meta:
        ordering = ['version', 'stage_number']
        verbose_name = "Load Shedding Stage"
        verbose_name_plural = "Load Shedding Stages"

    def __str__(self):
        return f"{self.label}"

    def save(self, *args, **kwargs):
        if not self.label and self.stage_number is not None:
            self.label = f"Stage {self.stage_number}"
        super().save(*args, **kwargs)


class LoadSheddingStageSetting(models.Model):
    stage = models.ForeignKey(LoadSheddingStage, on_delete=models.CASCADE)
    setting = models.ForeignKey(LoadSheddingSetting, on_delete=models.CASCADE)
    version = models.ForeignKey(LoadSheddingVersion, on_delete=models.CASCADE)

    class Meta:
        unique_together = (
            ('version', 'setting'),
            ('stage', 'setting'),
        )

    def save(self, *args, **kwargs):
        if self.stage_id and not self.version_id:
            self.version_id = self.stage.version_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.setting}"
