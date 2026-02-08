"""
Test script for Island Detection Service

Tests the graph-based island detection with real validated topology data
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.island_detection import IslandDetectionService
from core.models import IncomingBay

def test_island_detection():
    """Test island detection with real data"""
    
    print("=" * 80)
    print("ISLAND DETECTION SERVICE TEST")
    print("=" * 80)
    
    # 1. Build and display network graph
    print("\n1. Building Network Graph...")
    print("-" * 80)
    
    graph = IslandDetectionService.build_network_graph()
    print(f"✓ Graph built successfully")
    print(f"  Total substations in graph: {len(graph)}")
    print(f"  Total connections: {sum(len(neighbors) for neighbors in graph.values()) // 2}")
    
    # Display sample connections
    print("\n  Sample connections:")
    for sub_id, neighbors in list(graph.items())[:5]:
        print(f"    {sub_id} → {', '.join(sorted(neighbors))}")
    
    # 2. Get network statistics
    print("\n2. Network Statistics...")
    print("-" * 80)
    
    stats = IslandDetectionService.get_network_statistics()
    print(f"✓ Total substations: {stats['total_substations']}")
    print(f"✓ Total connections: {stats['total_connections']}")
    print(f"✓ Avg connections per substation: {stats['avg_connections_per_substation']}")
    
    print("\n  Top network hubs:")
    for hub in stats['top_hubs'][:5]:
        print(f"    {hub['substation_id']}: {hub['connection_count']} connections")
    
    # 3. Test island detection with a validated bay
    print("\n3. Testing Island Detection...")
    print("-" * 80)
    
    # Get a validated bay to test
    test_bay = IncomingBay.objects.filter(
        validation_status__in=['VALIDATED', 'AUTO_VALIDATED'],
        connected_to_substation__isnull=False
    ).select_related('substation', 'connected_to_substation').first()
    
    if test_bay:
        print(f"  Testing with bay: {test_bay.bay_id}")
        print(f"  Connection: {test_bay.substation.substation_id} → {test_bay.connected_to_substation.substation_id}")
        
        result = IslandDetectionService.find_islands(test_bay.bay_id)
        
        print(f"\n  Results:")
        print(f"    Isolated substations: {result['isolated_count']}")
        print(f"    Still connected: {result['still_connected_count']}")
        print(f"    Isolated load: {result['isolated_load_mw']} MW, {result['isolated_load_mvar']} Mvar")
        print(f"    Is critical: {'YES' if result['is_critical'] else 'NO'}")
        
        if result['isolated_count'] > 0:
            print(f"\n    Isolated substations list:")
            for sub_id in result['isolated_substations'][:10]:
                print(f"      - {sub_id}")
            if result['isolated_count'] > 10:
                print(f"      ... and {result['isolated_count'] - 10} more")
    else:
        print("  ⚠ No validated bays found to test")
    
    # 4. Identify critical bays
    print("\n4. Identifying Critical Bays...")
    print("-" * 80)
    print("  (This may take a minute as it tests all validated bays)")
    
    critical_bays = IslandDetectionService.identify_critical_bays()
    
    print(f"\n✓ Found {len(critical_bays)} critical bays")
    
    if critical_bays:
        print("\n  Top 5 most critical bays:")
        for i, bay in enumerate(critical_bays[:5], 1):
            print(f"\n  {i}. Bay: {bay['bay_id']}")
            print(f"     Connection: {bay['from_substation']} → {bay['to_substation']}")
            print(f"     Would isolate: {bay['isolated_count']} substations")
            print(f"     Load impact: {bay['isolated_load_mw']} MW")
            print(f"     Severity score: {bay['severity']}")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    test_island_detection()
