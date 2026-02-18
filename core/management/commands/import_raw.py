from django.core.management.base import BaseCommand
from services.import_service_v2 import ImportServiceV2
import os

class Command(BaseCommand):
    help = 'Import PSS/E .raw file into the database'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the .raw file')
        parser.add_argument('--name', type=str, help='Snapshot name', required=True)
        parser.add_argument('--description', type=str, help='Snapshot description', default='')

    def handle(self, *args, **kwargs):
        file_path = kwargs['file_path']
        name = kwargs['name']
        description = kwargs['description']

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'File not found: {file_path}'))
            return

        self.stdout.write(self.style.SUCCESS(f'Starting import of {file_path}...'))
        
        try:
            snapshot = ImportServiceV2.import_raw_file(file_path, name, description)
            self.stdout.write(self.style.SUCCESS(f'Successfully imported snapshot: {snapshot.name} (ID: {snapshot.id})'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Import failed: {str(e)}'))
