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

    class Meta:
        verbose_name = "Substation"
        verbose_name_plural = "Substations"
        ordering = ['substation_id']

    def __str__(self):
        return f"{self.name} ({self.substation_id})"

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
