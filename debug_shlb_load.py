import os
import django
import sys
from django.db.models import Q

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import BayLoad

def inspect_shlb():
    print("--- Inspecting 'SHLB' Load Data ---")
    
    term = "SHLB"
    print(f"Searching for '{term}' in BayLoad...")
    
    results = BayLoad.objects.filter(
        Q(mnemonic__icontains=term) | 
        Q(bus_name__icontains=term)
    )
    
    count = results.count()
    print(f"Found {count} records matching '{term}'.")
    
    if count > 0:
        print(f"\n{'Mnemonic':<10} | {'Bus Name':<20} | {'Bay ID':<10} | {'MW':<10} | {'MVar':<10} | {'Matched'}")
        print("-" * 80)
        total_mw = 0
        total_mvar = 0
        for r in results:
            print(f"{r.mnemonic:<10} | {r.bus_name:<20} | {r.bay_identifier:<10} | {r.pload_mw:<10} | {r.qload_mvar:<10} | {r.matched}")
            if r.matched:
                total_mw += r.pload_mw
                total_mvar += r.qload_mvar
        
        print("-" * 80)
        print(f"Total Visible on Dashboard (Matched Only): {total_mw:.2f} MW / {total_mvar:.2f} MVar")
        
        if total_mw == 0 and count > 0:
            print("\n⚠️ Records exist but are NOT matched yet.")
    else:
        print("No records found matching 'SHLB'.")
        print("Checking all mnemonics starting with 'S':")
        s_mnemonics = BayLoad.objects.filter(mnemonic__istartswith='S').values_list('mnemonic', flat=True).distinct()
        print(sorted(list(s_mnemonics)))

if __name__ == "__main__":
    inspect_shlb()
