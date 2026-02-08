from services.network_topology import NetworkTopologyService
from core.models import IncomingBay

all_bays = IncomingBay.objects.all()
total = all_bays.count()
updated = 0
auto_validated = 0
rejected = 0
equipment = 0

for bay in all_bays:
    detection = NetworkTopologyService.detect_connections(bay)
    old_status = bay.validation_status
    NetworkTopologyService.apply_detection_result(bay, detection)
    if old_status != bay.validation_status:
        updated += 1
    if bay.validation_status == 'AUTO_VALIDATED':
        auto_validated += 1
    elif bay.validation_status == 'REJECTED':
        rejected += 1
    if bay.connection_type == 'EQUIPMENT':
        equipment += 1

print(f"Total: {total}, Updated: {updated}, Auto-Validated: {auto_validated}, Equipment: {equipment}, Rejected: {rejected}")
