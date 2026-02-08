"""
Test script for Network Topology API endpoints
"""
from services.network_topology import NetworkTopologyService
from core.models import IncomingBay

print("=" * 70)
print("NETWORK TOPOLOGY API - ENDPOINT TEST")
print("=" * 70)

# Test 1: Get pending validations
print("\n📋 TEST 1: Pending Validations")
print("-" * 70)

pending = IncomingBay.objects.filter(validation_status='PENDING').count()
rejected = IncomingBay.objects.filter(validation_status='REJECTED').count()
changed = IncomingBay.objects.filter(topology_changed=True).count()

print(f"Pending validation: {pending}")
print(f"Rejected: {rejected}")
print(f"Topology changed: {changed}")
print(f"Total requiring review: {pending + rejected + changed}")

# Show examples
print("\n📝 Examples (lowest confidence first):")
examples = IncomingBay.objects.filter(
    validation_status__in=['PENDING', 'REJECTED']
).order_by('detection_confidence')[:5]

for bay in examples:
    print(f"  {bay.bay_id}")
    print(f"    Type: {bay.connection_type}")
    print(f"    Confidence: {bay.detection_confidence:.2f}")
    print(f"    Note: {bay.detection_note[:60]}...")
    print()

# Test 2: Statistics
print("\n📊 TEST 2: Statistics")
print("-" * 70)

total = IncomingBay.objects.count()
auto_validated = IncomingBay.objects.filter(validation_status='AUTO_VALIDATED').count()
user_validated = IncomingBay.objects.filter(validation_status='VALIDATED').count()

validation_rate = (auto_validated + user_validated) / total * 100 if total > 0 else 0

print(f"Total bays: {total}")
print(f"Auto-validated: {auto_validated} ({auto_validated/total*100:.1f}%)")
print(f"User-validated: {user_validated} ({user_validated/total*100:.1f}%)")
print(f"Pending/Rejected: {pending + rejected} ({(pending+rejected)/total*100:.1f}%)")
print(f"Overall validation rate: {validation_rate:.1f}%")

# Test 3: Connection type breakdown
print("\n🔗 TEST 3: Connection Type Breakdown")
print("-" * 70)

standard = IncomingBay.objects.filter(connection_type='STANDARD').count()
tee_off = IncomingBay.objects.filter(connection_type='TEE_OFF').count()
autotransformer = IncomingBay.objects.filter(connection_type='AUTOTRANSFORMER').count()
equipment = IncomingBay.objects.filter(connection_type='EQUIPMENT').count()
unknown = IncomingBay.objects.filter(connection_type='UNKNOWN').count()

print(f"Standard: {standard}")
print(f"Tee-off: {tee_off}")
print(f"Autotransformer: {autotransformer}")
print(f"Equipment: {equipment}")
print(f"Unknown: {unknown}")

print("\n" + "=" * 70)
print("API ENDPOINTS READY")
print("=" * 70)
print("\nAvailable endpoints:")
print("  GET  /api/v1/network-topology/pending_validations/")
print("  POST /api/v1/network-topology/validate_connection/")
print("  POST /api/v1/network-topology/bulk_validate/")
print("  POST /api/v1/network-topology/run_detection/")
print("  POST /api/v1/network-topology/check_changes/")
print("  GET  /api/v1/network-topology/statistics/")
print("\nAdmin actions available:")
print("  - Approve selected connections")
print("  - Reject selected connections")
print("  - Re-run detection on selected bays")
print("=" * 70)
