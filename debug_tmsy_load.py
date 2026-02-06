import os
import django
import sys
from django.db.models import Q

# Setup Django environment
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation, BayLoad, Transformer, IncomingBay
from services.bay_id_matcher import BayIDMatcher

def inspect_tmsy():
    print("--- Inspecting 'TMSY' Substation Data ---")

    # 1. Check Substation existence
    subs = Substation.objects.filter(Q(substation_id__icontains='TMSY') | Q(mnemonic__icontains='TMSY'))
    
    if not subs.exists():
        print("❌ No substation found matching 'TMSY'.")
    else:
        for s in subs:
            print(f"✅ Found Substation: {s.name} (ID: {s.substation_id}, Mnemonic: {s.mnemonic})")
            print(f"   Total Load: {s.total_pload_mw} MW")
            
            # Check components
            print(f"   Transformers: {s.transformers.count()}")
            for t in s.transformers.all():
                 matched = "✅" if hasattr(t, 'load_data') else "❌"
                 print(f"     - {t.bay_id} ({t.bay_name}): {matched}")
                 
            print(f"   Incoming Bays: {s.incoming_bays.count()}")
            # print first few bays if many
            for b in s.incoming_bays.all()[:5]:
                 matched = "✅" if hasattr(b, 'load_data') else "❌"
                 print(f"     - {b.bay_id} ({b.bay_name}): {matched}")

    # 2. Check Raw Load Data (BayLoad)
    print("\n--- Checking BayLoad Records for 'TMSY' ---")
    raw_loads = BayLoad.objects.filter(mnemonic__icontains='TMSY')
    
    if not raw_loads.exists():
        print("❌ No BayLoad records found with mnemonic 'TMSY'. Checking similar...")
        similar = BayLoad.objects.filter(mnemonic__startswith='T')
        mnemonics = set(similar.values_list('mnemonic', flat=True))
        print(f"   Available 'T' mnemonics: {sorted(list(mnemonics))[:20]}")
    else:
        print(f"Found {raw_loads.count()} BayLoad records matching 'TMSY':")
        matched_count = raw_loads.filter(matched=True).count()
        unmatched_count = raw_loads.filter(matched=False).count()
        print(f"   Matched: {matched_count}")
        print(f"   Unmatched: {unmatched_count}")
        
        if unmatched_count > 0:
            print("\n   Sample Unmatched Records (showing Bus Name for Regex check):")
            for l in raw_loads.filter(matched=False)[:5]:
                print(f"     - ID: {l.bay_identifier} | Bus Name: '{l.bus_name}' | MW: {l.pload_mw}")
                # Test regex on this bus name
                voltage = BayIDMatcher.extract_voltage_from_bus_name(l.bus_name)
                print(f"       -> Extracted Voltage: {voltage}")

if __name__ == "__main__":
    inspect_tmsy()
