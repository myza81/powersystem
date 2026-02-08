#!/usr/bin/env python
"""Force re-detection on all bays with enhanced rules"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, '/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.network_topology import NetworkTopologyService
from core.models import IncomingBay

print('=' * 70)
print('Re-running detection on ALL bays with enhanced rules...')
print('=' * 70)

all_bays = IncomingBay.objects.all()
total = all_bays.count()
updated = 0
auto_validated = 0
rejected = 0
equipment = 0

print(f'\nProcessing {total} bays...\n')

for i, bay in enumerate(all_bays, 1):
    detection = NetworkTopologyService.detect_connections(bay)
    old_status = bay.validation_status
    old_type = bay.connection_type
    NetworkTopologyService.apply_detection_result(bay, detection)
    
    if old_status != bay.validation_status or old_type != bay.connection_type:
        updated += 1
        print(f'  [{i}/{total}] {bay.bay_id}: {old_status}/{old_type} → {bay.validation_status}/{bay.connection_type}')
    
    if bay.validation_status == 'AUTO_VALIDATED':
        auto_validated += 1
    elif bay.validation_status == 'REJECTED':
        rejected += 1
    
    if bay.connection_type == 'EQUIPMENT':
        equipment += 1

print('\n' + '=' * 70)
print('✅ Complete!')
print(f'  Total Bays: {total}')
print(f'  Status Changed: {updated}')
print(f'  Auto-Validated: {auto_validated}')
print(f'  Equipment: {equipment}')
print(f'  Rejected: {rejected}')
print('=' * 70)

# Show sample of remaining rejected bays
if rejected > 0:
    print(f'\n❌ Sample Rejected Bays (first 10):')
    for bay in IncomingBay.objects.filter(validation_status='REJECTED')[:10]:
        print(f'  {bay.bay_id} ({bay.bay_name}): {bay.detection_note[:60]}...')
