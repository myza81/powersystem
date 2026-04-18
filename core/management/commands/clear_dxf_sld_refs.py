from django.core.management.base import BaseCommand
from core.models import Substation


class Command(BaseCommand):
    help = 'Clear sld_file references for substations whose DXF files no longer exist'

    def handle(self, *args, **options):
        qs = Substation.objects.filter(sld_file__endswith='.dxf')
        count = qs.count()

        if count == 0:
            self.stdout.write('No DXF sld_file references found.')
            return

        for sub in qs:
            self.stdout.write(f'  Clearing {sub.substation_id}: {sub.sld_file.name}')

        qs.update(sld_file='')
        self.stdout.write(self.style.SUCCESS(f'Cleared {count} DXF sld_file reference(s).'))
