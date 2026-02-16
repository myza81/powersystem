import os
import django
import sys

# Setup Django
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import NetworkSnapshot, NetworkLoad
from django.db.models import Sum

def list_unlinked_details():
    snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
    unlinked_loads = snapshot.loads.filter(bus__substation__isnull=True).select_related('bus', 'bus__psse_area')
    
    print(f"--- Top Unlinked Loads ---")
    print(f"{'Bus Name':<20} {'Base KV':<10} {'Area':<15} {'P MW':<10}")
    print("-" * 60)
    
    # Sort by p_mw desc
    loads = unlinked_loads.order_by('-p_mw')[:20]
    for load in loads:
        area_name = load.bus.psse_area.name if load.bus.psse_area else "None"
        print(f"{load.bus.bus_name:<20} {load.bus.base_kv:<10} {area_name:<15} {load.p_mw:<10.2f}")

    print(f"\n--- Unlinked Load by Area ---")
    area_sums = (
        unlinked_loads
        .values('bus__psse_area__name')
        .annotate(total_mw=Sum('p_mw'))
        .order_by('-total_mw')
    )
    for entry in area_sums:
        name = entry['bus__psse_area__name'] or "Unknown Area"
        print(f"{name:<20}: {entry['total_mw']:.2f} MW")

if __name__ == "__main__":
    list_unlinked_details()
