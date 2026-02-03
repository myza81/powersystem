import os
import django
import sys

# Setup Django environment
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation

def test_manual_entry_geocoding():
    print("Testing manual entry geocoding logic via Substation.save()...")
    
    # Create a substation without coordinates
    sub_id = "TEST999"
    # Clean up if exists
    Substation.objects.filter(substation_id=sub_id).delete()
    
    sub = Substation(
        substation_id=sub_id,
        mnemonic="TEST",
        name="Kuala Lumpur",
        voltage=500,
        grid="KLUM",
        ownership="TNB"
    )
    
    print(f"Saving substation {sub_id} with name 'Kuala Lumpur' and empty coordinates...")
    sub.save()
    
    # Reload from DB
    sub.refresh_from_db()
    
    print(f"\nResulting Metadata:")
    print(f"  Latitude: {sub.latitude}")
    print(f"  Longitude: {sub.longitude}")
    print(f"  State: {sub.state}")
    print(f"  Region: {sub.region}")
    
    if sub.latitude and sub.state:
        print("\n✅ Verification Successful: Geocoding triggered automatically on save.")
    else:
        print("\n❌ Verification Failed: Geocoding did not populate coordinates or state.")

if __name__ == "__main__":
    test_manual_entry_geocoding()
