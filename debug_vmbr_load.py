import os
import django
import sys

# Setup Django environment
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation, BayLoad, Transformer, IncomingBay
from django.db.models import Q

def inspect_vmbr():
    print("--- Inspecting 'VMBR' Substation Data ---")

    # 1. Check Substation existence
    subs = Substation.objects.filter(Q(substation_id__icontains='VMBR') | Q(mnemonic__icontains='VMBR') | Q(name__icontains='VMBR'))
    
    if not subs.exists():
        print("❌ No substation found matching 'VMBR' in ID, mnemonic, or name.")
    else:
        for s in subs:
            print(f"✅ Found Substation: {s.name} (ID: {s.substation_id}, Mnemonic: {s.mnemonic})")
            print(f"   Total Load (Property): {s.total_pload_mw} MW")
            
            # Check Transformers
            transformers = s.transformers.all()
            print(f"   Transformers ({transformers.count()}):")
            for t in transformers:
                load = t.load_data.pload_mw if hasattr(t, 'load_data') and t.load_data else "No Load"
                print(f"     - {t.bay_id} (Name: {t.bay_name}): {load}")

            # Check Incoming Bays
            bays = s.incoming_bays.all()
            print(f"   Incoming Bays ({bays.count()}):")
            for b in bays:
                load = b.load_data.pload_mw if hasattr(b, 'load_data') and b.load_data else "No Load"
                print(f"     - {b.bay_id} (Name: {b.bay_name}): {load}")

    # 2. Check Raw Load Data (BayLoad)
    print("\n--- Checking BayLoad Records for 'VMBR' ---")
    raw_loads = BayLoad.objects.filter(mnemonic__icontains='VMBR')
    
    if not raw_loads.exists():
        print("❌ No BayLoad records found with mnemonic 'VMBR'. Check upload file content?")
    else:
        print(f"Found {raw_loads.count()} BayLoad records matching 'VMBR':")
        matched_count = raw_loads.filter(matched=True).count()
        unmatched_count = raw_loads.filter(matched=False).count()
        print(f"   Matched: {matched_count}")
        print(f"   Unmatched: {unmatched_count}")
        
    print("\n--- all unique mnemonics in BayLoad ---")
    mnemonics = BayLoad.objects.values_list('mnemonic', flat=True).distinct().order_by('mnemonic')
    print("Available Mnemonics:", list(mnemonics))

    print("\n--- Checking for similar mnemonics to VMBR ---")
    similar = BayLoad.objects.filter(mnemonic__istartswith='V')
    for l in similar[:10]:
         print(f"  {l.mnemonic} - {l.bay_identifier}")

if __name__ == "__main__":
    inspect_vmbr()
