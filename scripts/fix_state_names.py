import os
import sys
import django

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation
from services.geocoding import GeocodingService

def fix_state_names():
    substations = Substation.objects.exclude(state__isnull=True).exclude(state='')
    count_updated = 0
    
    print(f"Checking {substations.count()} substations for state name normalization...")
    
    for sub in substations:
        original_state = sub.state
        normalized_state = GeocodingService.normalize_state(original_state)
        
        if original_state != normalized_state:
            print(f"Updating {sub.name} ({sub.substation_id}): '{original_state}' -> '{normalized_state}'")
            sub.state = normalized_state
            sub.save(update_fields=['state'])
            count_updated += 1
            
    print(f"\nCompleted. Updated {count_updated} substations.")

if __name__ == "__main__":
    fix_state_names()
