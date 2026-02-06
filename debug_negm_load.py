import os
import django
import sys
from django.db.models import Q

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import BayLoad, Substation, Transformer, IncomingBay
from services.bay_id_matcher import BayIDMatcher

def inspect_negm():
    print("--- Inspecting 'NEGM' Data ---")
    
    # 1. Check Substation & Bays
    print("\n[Topology Check]")
    subs = Substation.objects.filter(Q(substation_id__icontains='NEGM') | Q(mnemonic__icontains='NEGM'))
    if not subs.exists():
        print("❌ Substation NEGM not found.")
    else:
        for s in subs:
            print(f"✅ Substation: {s.name} ({s.substation_id})")
            print(f"   Transformers ({s.transformers.count()}):")
            for t in s.transformers.all():
                print(f"     - {t.bay_id} (BayName: '{t.bay_name}')")
            print(f"   Incoming Bays ({s.incoming_bays.count()}):")
            for b in s.incoming_bays.all():
                print(f"     - {b.bay_id} (BayName: '{b.bay_name}')")

    print("\n[Triggering Rematch for Verification]")
    from services.load_profile_service import LoadProfileService
    LoadProfileService.rematch_unmatched_loads()

    # 2. Check Load Data
    print("\n[Load Data Check]")
    term = "NEGM"
    results = BayLoad.objects.filter(mnemonic__icontains=term)
    count = results.count()
    print(f"Found {count} BayLoad records for '{term}'.")
    
    if count > 0:
        print(f"\n{'Mnemonic':<10} | {'Bus Name':<20} | {'Bay ID (File)':<15} | {'Matched?':<10} | {'Linked To'}")
        print("-" * 100)
        for r in results:
            linked = "None"
            if r.transformer: linked = f"Trans: {r.transformer.bay_id}"
            elif r.incoming_bay: linked = f"Bay: {r.incoming_bay.bay_id}"
            
            # Check for phantom
            phantom_status = ""
            if r.matched and linked == "None":
                phantom_status = "❌ PHANTOM"
            
            print(f"{r.mnemonic:<10} | {r.bus_name:<20} | {r.bay_identifier:<15} | {str(r.matched):<10} | {linked} {phantom_status}")
            
            # Debug Matching Logic if unmatched or phantom
            if not r.matched or phantom_status:
                print(f"   [Debug Match] Trying to match '{r.bay_identifier}'...")
                voltage = BayIDMatcher.extract_voltage_from_bus_name(r.bus_name)
                print(f"     -> Extracted Voltage: {voltage}")
                if voltage:
                    sub_id = f"{r.mnemonic}{voltage}"
                    print(f"     -> Target SubID: {sub_id}")
                    # Try to find target bay in DB
                    t_exists = Transformer.objects.filter(substation__substation_id=sub_id, bay_name=r.bay_identifier).exists()
                    b_exists = IncomingBay.objects.filter(substation__substation_id=sub_id, bay_name=r.bay_identifier).exists()
                    print(f"     -> Transformer Exists? {t_exists}")
                    print(f"     -> IncomingBay Exists? {b_exists}")
    else:
        print("No records found for NEGM.")
        # Check similar mnemonics
        print("Checking for similar mnemonics starting with 'N'...")
        similar = BayLoad.objects.filter(mnemonic__startswith='N')[:10]
        seen = set()
        for s in similar:
            if s.mnemonic not in seen:
                print(f"  {s.mnemonic}")
                seen.add(s.mnemonic)

if __name__ == "__main__":
    inspect_negm()
