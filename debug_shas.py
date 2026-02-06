import os
import django
import sys
from django.db.models import Q

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import BayLoad, Substation, Transformer, IncomingBay
from services.bay_id_matcher import BayIDMatcher

def inspect_shas():
    print("--- Inspecting 'SHAS' Data ---")
    
    # Check Substation
    subs = Substation.objects.filter(Q(substation_id__icontains='SHAS') | Q(mnemonic__icontains='SHAS'))
    for s in subs:
        print(f"✅ Substation: {s.name} ({s.substation_id})")
        print(f"   Transformers: {[t.bay_id for t in s.transformers.all()]}")

    # Check Load Records
    records = BayLoad.objects.filter(mnemonic__icontains='SHAS')
    print(f"\nFound {records.count()} load records for SHAS.")
    
    phantom_count = 0
    unmatched_count = 0
    
    if records.exists():
        print(f"\n{'Mnemonic':<10} | {'Bay':<10} | {'Matched':<10} | {'Parent'}")
        print("-" * 60)
        for r in records:
            parent = "None"
            if r.transformer: parent = "Trans"
            if r.incoming_bay: parent = "Bay"
            
            # Detect Phantom
            is_phantom = r.matched and (not r.transformer and not r.incoming_bay)
            status = "✅ OK"
            if is_phantom:
                status = "❌ PHANTOM"
                phantom_count += 1
            elif not r.matched:
                status = "⚠️ Unmatched"
                unmatched_count += 1
                
            print(f"{r.mnemonic:<10} | {r.bay_identifier:<10} | {str(r.matched):<10} | {parent} ({status})")

    if phantom_count > 0:
        print(f"\n❌ FOUND {phantom_count} PHANTOM MATCHES! Signals are NOT working.")
    elif unmatched_count > 0:
        print(f"\n⚠️ FOUND {unmatched_count} UNMATCHED RECORDS. Auto-rematch failed.")
    else:
        print("\n✅ All appear matched and valid.")

if __name__ == "__main__":
    inspect_shas()
