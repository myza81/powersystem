import os
import django
import sys
from django.db.models import Q

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import BayLoad
from services.load_profile_service import LoadProfileService

def fix_phantoms():
    print("--- Fixing Phantom Matches ---")
    
    # Find records where matched=True but both FKs are None
    phantoms = BayLoad.objects.filter(
        matched=True,
        transformer__isnull=True,
        incoming_bay__isnull=True
    )
    
    count = phantoms.count()
    print(f"Found {count} phantom matched records.")
    
    if count > 0:
        print("Resetting matched=False for these records...")
        phantoms.update(matched=False)
        print("✅ Reset complete.")
        
        print("Triggering Rematch...")
        LoadProfileService.rematch_unmatched_loads()
        print("✅ Rematch attempt complete.")
        
        # Verify SHAW specifically
        shaw = BayLoad.objects.filter(mnemonic='SHAW', bay_identifier='T1').first()
        if shaw:
            print(f"SHAW T1 Status: Matched={shaw.matched}, Trans={shaw.transformer}")
    else:
        print("No phantom matches found. Triggering rematch anyway just in case.")
        LoadProfileService.rematch_unmatched_loads()

if __name__ == "__main__":
    fix_phantoms()
