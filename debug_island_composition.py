import os
import django
from collections import Counter
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import NetworkSnapshot, NetworkBus
from services.topology_service import TopologyService

def analyze():
    with open('island_debug_output.txt', 'w') as f:
        # Get latest snapshot
        try:
            snapshot = NetworkSnapshot.objects.latest('timestamp')
            f.write(f"Analyzing Snapshot: {snapshot.name} ({snapshot.id})\n")
        except NetworkSnapshot.DoesNotExist:
            f.write("No snapshots found.\n")
            return

        # 1. Check Bus Type Distribution
        f.write("\n--- Bus Type Distribution ---\n")
        types = NetworkBus.objects.filter(snapshot=snapshot).values_list('bus_type', flat=True)
        type_counts = Counter(types)
        for btype, count in sorted(type_counts.items()):
            f.write(f"Type {btype}: {count} buses\n")

        # 2. Run Topology Analysis
        f.write("\n--- Topology Analysis ---\n")
        service = TopologyService(snapshot)
        service.build_graph()
        islands = service.analyze_islands()
        
        f.write(f"Total Islands Found: {len(islands)}\n")
        
        # 3. Analyze Island Sizes
        island_sizes = [i['bus_count'] for i in islands]
        size_counts = Counter(island_sizes)
        f.write("\nIsland Size Histogram:\n")
        for size, count in sorted(size_counts.items()):
            f.write(f"Size {size}: {count} islands\n")

        # 4. Deep Dive into Small Islands
        f.write("\n--- Sample of Small Islands (Size < 5) ---\n")
        small_islands = [i for i in islands if i['bus_count'] < 5]
        
        # Check what kind of buses are in these small islands
        for idx, island in enumerate(small_islands[:20]): # Show first 20
            bus_ids = island['bus_ids']
            buses = NetworkBus.objects.filter(id__in=bus_ids)
            bus_details = []
            for b in buses:
                 bus_details.append(f"{b.bus_number} {b.bus_name} ({b.base_kv}kV) Type={b.bus_type}")
            
            status = island['status']
            f.write(f"Island {idx+1} ({status}): {', '.join(bus_details)}\n")

if __name__ == "__main__":
    analyze()
