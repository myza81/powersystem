import uuid
from django.db import models
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)

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

class Substation(models.Model):
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
    mnemonic = models.CharField(max_length=10)
    name = models.CharField(max_length=100)
    ownership = models.CharField(max_length=50, choices=OWNERSHIP_CHOICES, default='TNB')
    voltage = models.IntegerField(choices=VOLTAGE_CHOICES)
    
    # New Columns
    grid = models.CharField(max_length=10, choices=GRID_CHOICES, null=True, blank=True)
    state = models.CharField(max_length=50, null=True, blank=True)
    region = models.CharField(max_length=20, null=True, blank=True)
    sync_log = models.TextField(null=True, blank=True)
    commission_date = models.DateField(null=True, blank=True)

    # SLD handling
    sld = models.CharField(max_length=255, help_text="Generated as {substation_id}.pdf")
    sld_file = models.FileField(
        upload_to=substation_sld_path, 
        storage=OverwriteStorage(),
        null=True, blank=True, 
        help_text="Upload PDF or Image SLD"
    )
    
    # Coordinates
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        from services.geocoding import GeocodingService
        
        # Detect if we are updating and if coordinates changed
        coords_changed = False
        if self.pk:
            try:
                old_instance = Substation.objects.get(pk=self.pk)
                if old_instance.latitude != self.latitude or old_instance.longitude != self.longitude:
                    coords_changed = True
            except Substation.DoesNotExist:
                pass

        # 1. Full Geocoding if coordinates are missing
        if self.latitude is None or self.longitude is None:
            try:
                lat, lng, state_val = GeocodingService.get_coordinates(self.name, self.mnemonic)
                if lat and lng:
                    self.latitude, self.longitude = lat, lng
                    if state_val:
                        self.state = state_val
            except Exception as e:
                logger.warning(f"Auto-geocoding failed for {self.name}: {str(e)}")
                self.sync_log = f"Geocoding Warning: {str(e)}"
        
        # 2. Reverse Geocoding if coordinates changed or state is missing but coords exist
        elif coords_changed or (self.state is None and self.latitude and self.longitude):
            try:
                state_val = GeocodingService.reverse_geocode(self.latitude, self.longitude)
                if state_val:
                    self.state = state_val
            except Exception as e:
                logger.warning(f"Reverse geocoding failed for {self.name}: {str(e)}")

        # 3. Automated Region derivation
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
        
        # 4. Ensure sld filename consistency
        if self.sld_file:
            # Use uploaded file's extension
            ext = self.sld_file.name.split('.')[-1]
            self.sld = f"{self.substation_id}.{ext}"
        elif not self.sld:
            self.sld = f"{self.substation_id}.pdf"
        
        super().save(*args, **kwargs)
        
        # Trigger rematch of potential unmatched loads
        try:
            from services.load_profile_service import LoadProfileService
            LoadProfileService.rematch_unmatched_loads()
        except Exception as e:
            logger.error(f"Failed to rematch loads after Substation save: {e}")

    class Meta:
        verbose_name = "Substation"
        verbose_name_plural = "Substations"
        ordering = ['substation_id']

    def __str__(self):
        return f"{self.name} ({self.substation_id})"
    
    @property
    def total_pload_mw(self):
        """Aggregate active power load from all transformers and incoming bays."""
        from django.db.models import Sum
        transformer_load = self.transformers.aggregate(
            total=Sum('load_data__pload_mw')
        )['total'] or 0
        bay_load = self.incoming_bays.aggregate(
            total=Sum('load_data__pload_mw')
        )['total'] or 0
        return transformer_load + bay_load
    
    @property
    def total_qload_mvar(self):
        """Aggregate reactive power load from all transformers and incoming bays."""
        from django.db.models import Sum
        transformer_load = self.transformers.aggregate(
            total=Sum('load_data__qload_mvar')
        )['total'] or 0
        bay_load = self.incoming_bays.aggregate(
            total=Sum('load_data__qload_mvar')
        )['total'] or 0
        return transformer_load + bay_load

class Transformer(models.Model):
    substation = models.ForeignKey(Substation, related_name='transformers', on_delete=models.CASCADE)
    bay_name = models.CharField(max_length=50) # e.g. T1 - User Input
    bay_id = models.CharField(max_length=50, unique=True, blank=True) # e.g. ADAM132_T1 - Auto-generated
    transformer_type = models.CharField(max_length=50, null=True, blank=True) # e.g. 132/11kV
    sequence_number = models.IntegerField(null=True, blank=True)
    hv_voltage = models.IntegerField(null=True, blank=True)
    lv_voltage = models.IntegerField(null=True, blank=True)
    capacity_mva = models.FloatField(null=True, blank=True)
    hv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    lv_breaker_number = models.CharField(max_length=10, null=True, blank=True)
    commission_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        # Auto-generate Global ID from Name
        if self.bay_name and self.substation:
            self.bay_id = f"{self.substation.substation_id}_{self.bay_name}"
        super().save(*args, **kwargs)
        
        # Trigger rematch of potential unmatched loads
        try:
            from services.load_profile_service import LoadProfileService
            LoadProfileService.rematch_unmatched_loads()
        except Exception as e:
            logger.error(f"Failed to rematch loads after Transformer save: {e}")

class IncomingBay(models.Model):
    substation = models.ForeignKey(Substation, related_name='incoming_bays', on_delete=models.CASCADE)
    bay_name = models.CharField(max_length=100) # e.g. SRDN1 - User Input
    bay_id = models.CharField(max_length=50, unique=True, blank=True) # e.g. ADAM132_SRDN1 - Auto-generated
    voltage = models.IntegerField(null=True, blank=True)
    breaker_number = models.CharField(max_length=10, null=True, blank=True)
    sequence_number = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        # Auto-generate Global ID from Name
        if self.bay_name and self.substation:
            self.bay_id = f"{self.substation.substation_id}_{self.bay_name}"
        super().save(*args, **kwargs)
        
        # Trigger rematch of potential unmatched loads
        try:
            from services.load_profile_service import LoadProfileService
            LoadProfileService.rematch_unmatched_loads()
        except Exception as e:
            logger.error(f"Failed to rematch loads after IncomingBay save: {e}")

class BayLoad(models.Model):
    """
    Stores load profile data (MW/Mvar) linked to transformer or incoming bay.
    Data is replaced on each new upload.
    """
    # Foreign keys (nullable to support unmatched data logging)
    transformer = models.OneToOneField(
        Transformer, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='load_data'
    )
    incoming_bay = models.OneToOneField(
        IncomingBay, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='load_data'
    )
    
    # Load data from Excel
    pload_mw = models.FloatField(help_text="Active power load in MW")
    qload_mvar = models.FloatField(help_text="Reactive power load in Mvar")
    
    # Metadata from Excel (for traceability)
    bus_name = models.CharField(max_length=100)
    mnemonic = models.CharField(max_length=10)
    bay_identifier = models.CharField(max_length=20, help_text="T1, T2, F1, etc.")
    
    # Upload tracking
    upload_timestamp = models.DateTimeField(auto_now_add=True)
    upload_batch_id = models.UUIDField(default=uuid.uuid4, help_text="Groups rows from same upload")
    matched = models.BooleanField(default=False, help_text="Successfully matched to bay_id")
    
    class Meta:
        indexes = [
            models.Index(fields=['upload_batch_id']),
            models.Index(fields=['matched']),
        ]
    
    def __str__(self):
        if self.transformer:
            return f"Load: {self.transformer.bay_id} ({self.pload_mw} MW)"
        elif self.incoming_bay:
            return f"Load: {self.incoming_bay.bay_id} ({self.pload_mw} MW)"
        return f"Unmatched Load: {self.mnemonic}-{self.bay_identifier}"
