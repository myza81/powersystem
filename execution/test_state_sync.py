import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv()

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "powersystem_core.settings")
django.setup()

from core.models import Substation

def verify_coordinate_state_sync():
    print("Testing Coordinate-State Sync Fix...")
    
    # 1. Create a substation with specific coords (Kuala Lumpur area)
    # 3.1412, 101.6865 is KL
    sub, created = Substation.objects.get_or_create(
        substation_id='SYNC_TEST_132',
        defaults={
            'mnemonic': 'STEST',
            'name': 'Sync Test Substation',
            'voltage': 132,
            'grid': 'KLUM',
            'latitude': 3.1412,
            'longitude': 101.6865
        }
    )
    print(f"Created/Found Substation: {sub.substation_id}, State: {sub.state}")
    
    # 2. Manually change coordinates to Melaka (2.1896, 102.2501)
    print("\nUpdating coordinates to Melaka...")
    sub.latitude = 2.1896
    sub.longitude = 102.2501
    sub.save()
    
    # Refresh from DB
    sub.refresh_from_db()
    print(f"Post-Update State: {sub.state}")
    
    if "Melaka" in (sub.state or "") or "Malacca" in (sub.state or ""):
        print("✅ SUCCESS: State updated automatically based on new coordinates.")
    else:
        print(f"❌ FAILURE: State remains {sub.state}")

if __name__ == "__main__":
    verify_coordinate_state_sync()
