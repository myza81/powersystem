
import os
import django
import sys
import re
from collections import defaultdict

# Setup Django environment
sys.path.append('/Users/myijat/Documents/Dojo/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import NetworkBus, NetworkSnapshot

def update_metadata():
    snapshot_id = 'c9921400-0b65-4464-b5aa-2c9ff35451c3'
    snapshot = NetworkSnapshot.objects.get(id=snapshot_id)
    print(f"Updating metadata for snapshot: {snapshot.name}")
    
    # 1. Find currently unmapped buses (Transmission level only to match import logic)
    # Import logic filtered for base_kv in [500, 275, 132]
    unmapped_buses = NetworkBus.objects.filter(
        snapshot=snapshot, 
        substation__isnull=True,
        base_kv__in=[500.0, 275.0, 132.0]
    )
    
    print(f"Found {unmapped_buses.count()} unmapped transmission buses.")
    
    # 2. Re-construct unmatched_mnemonics structure
    unmatched_mnemonics = defaultdict(list)
    
    for bus in unmapped_buses:
        # Extract mnemonic logic (same as import service)
        match = re.search(r'([A-Z]+)', bus.bus_name.strip())
        mnemonic = match.group(1) if match else "UNKNOWN"
        
        # Filter out fictitious if needed (logic from import service)
        if re.search(r'(FIC|TEMP|TMP|FICT)', bus.bus_name, re.IGNORECASE):
            continue
            
        unmatched_mnemonics[mnemonic].append({
            'bus_number': bus.bus_number,
            'bus_name': bus.bus_name,
            'voltage': bus.base_kv
        })
    
    # 3. Update Snapshot Metadata
    metadata = snapshot.metadata or {}
    old_count = len(metadata.get('unmatched_mnemonics', {}))
    
    # Convert defaultdict to dict
    metadata['unmatched_mnemonics'] = dict(unmatched_mnemonics)
    
    snapshot.metadata = metadata
    snapshot.save()
    
    new_count = len(metadata['unmatched_mnemonics'])
    print(f"Metadata updated.")
    print(f"Old Mnemonic Groups: {old_count}")
    print(f"New Mnemonic Groups: {new_count}")

if __name__ == "__main__":
    update_metadata()
