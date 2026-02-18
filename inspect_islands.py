
import os
import django
import sys

# Setup Django environment
sys.path.append('/Users/myijat/Documents/Dojo/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.island_detection_service import IslandDetectionService
from core.models import NetworkBus, NetworkBranch

def inspect_islands():
    snapshot_id = 'c9921400-0b65-4464-b5aa-2c9ff35451c3'
    print(f"Inspecting snapshot: {snapshot_id}")
    
    result = IslandDetectionService.analyze_snapshot(snapshot_id)
    islands = result['islands']
    
    small_islands = [i for i in islands if i['bus_count'] <= 5 and i['status'] != 'Main Grid']
    
    print(f"\nFound {len(small_islands)} small disconnected islands.")
    
    for island in small_islands:
        print(f"\n--- Island #{island['id']} ({island['status']}) ---")
        bus_ids = island['bus_ids']
        buses = NetworkBus.objects.filter(id__in=bus_ids).select_related('substation')
        
        for bus in buses:
            sub_name = bus.substation.name if bus.substation else "NO SUBSTATION"
            print(f"Bus ID: {bus.bus_number} ({bus.id})")
            print(f"  Name: {bus.bus_name}")
            print(f"  kV:   {bus.base_kv}")
            print(f"  Sub:  {sub_name}")
            
            # Check connections (even inactive ones)
            branches = NetworkBranch.objects.filter(from_bus=bus) | NetworkBranch.objects.filter(to_bus=bus)
            print(f"  Total Branches Linked: {branches.count()}")
            for b in branches:
                status = "ACTIVE" if b.is_active else "INACTIVE"
                other = b.to_bus if b.from_bus == bus else b.from_bus
                print(f"    - To {other.bus_number} ({other.bus_name}): {status}")

if __name__ == "__main__":
    inspect_islands()
