from django.core.management.base import BaseCommand
from services.network_topology import NetworkTopologyService
from core.models import IncomingBay


class Command(BaseCommand):
    help = 'Force re-detection on ALL incoming bays (not just pending)'

    def handle(self, *args, **options):
        self.stdout.write('Re-running detection on ALL bays with enhanced rules...')
        self.stdout.write('=' * 70)
        
        all_bays = IncomingBay.objects.all()
        total = all_bays.count()
        updated = 0
        auto_validated = 0
        rejected = 0
        equipment = 0
        
        for i, bay in enumerate(all_bays, 1):
            detection = NetworkTopologyService.detect_connections(bay)
            old_status = bay.validation_status
            NetworkTopologyService.apply_detection_result(bay, detection)
            
            if old_status != bay.validation_status:
                updated += 1
                self.stdout.write(
                    f'  [{i}/{total}] {bay.bay_id}: {old_status} → {bay.validation_status}'
                )
            
            if bay.validation_status == 'AUTO_VALIDATED':
                auto_validated += 1
            elif bay.validation_status == 'REJECTED':
                rejected += 1
            
            if bay.connection_type == 'EQUIPMENT':
                equipment += 1
        
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS(f'✅ Complete!'))
        self.stdout.write(f'  Total Bays: {total}')
        self.stdout.write(f'  Status Changed: {updated}')
        self.stdout.write(f'  Auto-Validated: {auto_validated}')
        self.stdout.write(f'  Equipment: {equipment}')
        self.stdout.write(f'  Rejected: {rejected}')
        self.stdout.write('=' * 70)
