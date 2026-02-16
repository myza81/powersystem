import os
import django
import sys

# Setup Django
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import NetworkSnapshot, NetworkLoad, Substation
from django.db.models import Sum

def verify_loads():
    snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
    if not snapshot:
        print("No snapshot found")
        return

    print(f"Checking Snapshot: {snapshot.name} ({snapshot.timestamp})")
    
    all_loads = snapshot.loads.all()
    total_mw = all_loads.aggregate(total=Sum('p_mw'))['total'] or 0
    total_mvar = all_loads.aggregate(total=Sum('q_mvar'))['total'] or 0
    
    linked_loads = snapshot.loads.filter(bus__substation__isnull=False)
    linked_mw = linked_loads.aggregate(total=Sum('p_mw'))['total'] or 0
    
    unlinked_loads = snapshot.loads.filter(bus__substation__isnull=True)
    unlinked_mw = unlinked_loads.aggregate(total=Sum('p_mw'))['total'] or 0
    
    print(f"Total System Demand (All): {total_mw:.2f} MW")
    print(f"Total Reactive Power (All): {total_mvar:.2f} Mvar")
    print(f"Linked Load (Sum of Regions): {linked_mw:.2f} MW")
    print(f"Unlinked Load (The Missing Part): {unlinked_mw:.2f} MW")
    print(f"Difference: {total_mw - linked_mw:.2f} MW")
    
    if unlinked_mw > 0:
        print("\nTop Unlinked Mnemonics:")
        from collections import Counter
        mnemonics = []
        for load in unlinked_loads.select_related('bus'):
            # Extract mnemonic from bus name (usually [MNEM][VOLT])
            name = load.bus.bus_name
            import re
            m = re.match(r'^([A-Z]+)', name)
            if m:
                mnemonics.append(m.group(1))
            else:
                mnemonics.append("UNKNOWN")
        
        counts = Counter(mnemonics).most_common(10)
        for mnem, count in counts:
            mw = unlinked_loads.filter(bus__bus_name__startswith=mnem).aggregate(s=Sum('p_mw'))['s'] or 0
            print(f"- {mnem}: {count} buses, {mw:.2f} MW")

if __name__ == "__main__":
    verify_loads()
