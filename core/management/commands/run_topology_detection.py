from django.core.management.base import BaseCommand
from services.network_topology import NetworkTopologyService
from core.models import IncomingBay


class Command(BaseCommand):
    help = 'Run network topology detection on all incoming bays'

    def handle(self, *args, **options):
        self.stdout.write('Running topology detection...')
        self.stdout.write('=' * 60)
        
        results = NetworkTopologyService.auto_detect_all()
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ Detection Complete!'))
        self.stdout.write(f'  Processed: {results["processed"]}')
        self.stdout.write(f'  Auto-Validated: {results["auto_validated"]}')
        self.stdout.write(f'  Pending Review: {results["pending_review"]}')
        self.stdout.write(f'  Rejected: {results["rejected"]}')
        
        # Show current stats
        rejected_count = IncomingBay.objects.filter(validation_status='REJECTED').count()
        auto_validated_count = IncomingBay.objects.filter(validation_status='AUTO_VALIDATED').count()
        
        self.stdout.write(f'\n📊 Database Status:')
        self.stdout.write(f'  Rejected: {rejected_count}')
        self.stdout.write(f'  Auto-Validated: {auto_validated_count}')
        
        # Show rejected examples
        if rejected_count > 0:
            self.stdout.write(f'\n❌ Sample Rejected Bays:')
            for bay in IncomingBay.objects.filter(validation_status='REJECTED')[:10]:
                self.stdout.write(f'  {bay.bay_id}: {bay.detection_note[:70]}')
        
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('Done! Refresh the frontend to see results.'))
