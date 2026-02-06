import os
import django
import sys
from django.db.models import Q

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import BayLoad

def deep_search():
    print("--- Deep Search in BayLoad ---")
    
    term = "TMSY"
    print(f"Searching for '{term}' in mnemonic, bus_name, bay_identifier...")
    
    results = BayLoad.objects.filter(
        Q(mnemonic__icontains=term) | 
        Q(bus_name__icontains=term) | 
        Q(bay_identifier__icontains=term)
    )
    
    count = results.count()
    print(f"Found {count} records.")
    
    if count > 0:
        print("Sample records:")
        for r in results[:10]:
            print(f"  ID: {r.id} | Mnemonic: {r.mnemonic} | Bus: {r.bus_name} | Bay: {r.bay_identifier} | MW: {r.pload_mw} | Matched: {r.matched}")
            
    print("\n--- Checking for Zero Load Records (Unmatched) ---")
    zeros = BayLoad.objects.filter(matched=False, pload_mw=0)
    print(f"Found {zeros.count()} unmatched records with 0 MW.")
    if zeros.count() > 0:
        print("Sample zero records:")
        for r in zeros[:5]:
             print(f"  Mnemonic: {r.mnemonic} | Bus: {r.bus_name}")

if __name__ == "__main__":
    deep_search()
