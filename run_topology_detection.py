#!/usr/bin/env python
"""
Run network topology detection and show results
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.network_topology import NetworkTopologyService
from core.models import IncomingBay

print('Running full topology detection...')
print('=' * 60)

results = NetworkTopologyService.auto_detect_all()

print(f"\n✅ Detection Complete!")
print(f"  Processed: {results['processed']}")
print(f"  Auto-Validated: {results['auto_validated']}")
print(f"  Pending Review: {results['pending_review']}")
print(f"  Rejected: {results['rejected']}")

# Show current database stats
rejected_count = IncomingBay.objects.filter(validation_status='REJECTED').count()
auto_validated_count = IncomingBay.objects.filter(validation_status='AUTO_VALIDATED').count()
pending_count = IncomingBay.objects.filter(validation_status='PENDING').count()

print(f"\n📊 Current Database Status:")
print(f"  Rejected: {rejected_count}")
print(f"  Auto-Validated: {auto_validated_count}")
print(f"  Pending: {pending_count}")

# Show some rejected examples
if rejected_count > 0:
    print(f"\n❌ Sample Rejected Bays (first 5):")
    rejected_bays = IncomingBay.objects.filter(validation_status='REJECTED')[:5]
    for bay in rejected_bays:
        print(f"  {bay.bay_id} ({bay.bay_name}): {bay.detection_note[:80]}")

print('\n' + '=' * 60)
print('Done! Refresh the frontend to see updated results.')
