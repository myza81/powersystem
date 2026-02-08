#!/usr/bin/env python
"""
Test script for network topology detection
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem.settings')
django.setup()

from services.network_topology import NetworkTopologyService
from core.models import IncomingBay

print("=" * 60)
print("NETWORK TOPOLOGY DETECTION - BULK TEST")
print("=" * 60)

# Run bulk detection
results = NetworkTopologyService.auto_detect_all()

print(f"\n📊 RESULTS:")
print(f"  Processed: {results['processed']}")
print(f"  Auto-validated: {results['auto_validated']}")
print(f"  Pending review: {results['pending_review']}")
print(f"  Rejected: {results['rejected']}")

print(f"\n📋 LOW CONFIDENCE CASES: {len(results['details'])}")
for detail in results['details'][:10]:
    print(f"  - {detail['bay_id']}: {detail['note'][:70]}...")

# Show some examples
print(f"\n✅ AUTO-VALIDATED EXAMPLES:")
auto_validated = IncomingBay.objects.filter(validation_status='AUTO_VALIDATED')[:5]
for bay in auto_validated:
    print(f"  {bay.bay_id} → {bay.connection_summary} (conf: {bay.detection_confidence:.2f})")

print(f"\n⏳ PENDING REVIEW EXAMPLES:")
pending = IncomingBay.objects.filter(validation_status='PENDING')[:5]
for bay in pending:
    print(f"  {bay.bay_id} → {bay.connection_summary} (conf: {bay.detection_confidence:.2f})")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
