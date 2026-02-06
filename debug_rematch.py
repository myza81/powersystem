import os
import django
import sys

# Setup Django environment
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation, BayLoad, Transformer
from services.load_profile_service import LoadProfileService

def test_rematch_flow():
    print("--- Testing Rematch Logic ---")
    
    # 1. Cleanup
    mnemonic = 'TEST99'
    sub_id = 'TEST99132' # 132kV
    
    BayLoad.objects.filter(mnemonic=mnemonic).delete()
    Transformer.objects.filter(bay_id__startswith=sub_id).delete()
    Substation.objects.filter(substation_id=sub_id).delete()
    
    print("Cleaned up previous test data.")
    
    # 2. Create Unmatched BayLoad
    print("Creating Unmatched BayLoad...")
    BayLoad.objects.create(
        mnemonic=mnemonic,
        bay_identifier='T1',
        bus_name='TEST99 132kV', # Should extract 132kV
        pload_mw=10.5,
        qload_mvar=2.1,
        matched=False
    )
    
    # Verify it's there
    load = BayLoad.objects.get(mnemonic=mnemonic, bay_identifier='T1')
    print(f"Created Load: ID={load.id}, Matched={load.matched}, Transformer={load.transformer}")
    
    if load.matched:
        print("❌ Error: Load should be unmatched initially.")
        return

    # 3. Create Substation (Should trigger rematch)? 
    # Actually Rematch is triggered on Save.
    # But usually we need the Transformer to match, right?
    # Substation matching just matches the substation part.
    # BayIDMatcher matches to Transformer or IncomingBay.
    # So we need to create the Transformer.
    
    print("\nCreating Substation...")
    sub = Substation.objects.create(
        substation_id=sub_id,
        mnemonic=mnemonic,
        name="Test Rematch Sub",
        voltage=132,
        ownership='TNB'
    )
    
    # Check if matched? Unlikely, unless we match purely on Substation (BayIDMatcher usually matches to Bay).
    load.refresh_from_db()
    print(f"After Substation Create -> Matched={load.matched}")
    
    print("\nCreating Transformer...")
    # This should trigger rematch
    trans = Transformer.objects.create(
        substation=sub,
        bay_name='T1',
        # bay_id auto-generated to TEST99132_T1
    )
    print(f"Created Transformer: {trans.bay_id}")
    
    # 4. Verify Match
    load.refresh_from_db()
    print(f"After Transformer Create -> Matched={load.matched}")
    print(f"Linked Transformer: {load.transformer}")
    
    if load.matched and load.transformer == trans:
        print("✅ SUCCESS: Rematching worked automatically.")
    else:
        print("❌ FAILURE: Load did not match automatically.")
        # Trigger manually to see if code works at all
        print("Triggering manual rematch...")
        LoadProfileService.rematch_unmatched_loads()
        load.refresh_from_db()
        print(f"After Manual Rematch -> Matched={load.matched}")

if __name__ == "__main__":
    test_rematch_flow()
