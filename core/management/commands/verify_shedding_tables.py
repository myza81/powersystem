"""
Management command: verify_shedding_tables
Writes DB table status to media/shedding_check.json
Usage:  python manage.py verify_shedding_tables
"""
from django.core.management.base import BaseCommand
from django.db import connection
import json, os
from django.conf import settings


class Command(BaseCommand):
    help = 'Check that load shedding tables exist and write result to media/shedding_check.json'

    def handle(self, *args, **options):
        target_tables = [
            'core_protectionrelay',
            'core_relaytripassignment',
            'core_loadsheddingscheme',
            'core_schemeversion',
            'core_shedgroupsetting',
            'core_shedgroupassignment',
        ]

        existing = connection.introspection.table_names()
        result = {t: (t in existing) for t in target_tables}
        all_ok = all(result.values())

        # Try to apply migration if tables missing
        if not all_ok:
            from django.core.management import call_command
            from io import StringIO
            out = StringIO()
            try:
                call_command('migrate', 'core', verbosity=2, stdout=out, stderr=out)
                migrate_output = out.getvalue()
            except Exception as e:
                migrate_output = str(e)

            # Re-check
            existing2 = connection.introspection.table_names()
            result2 = {t: (t in existing2) for t in target_tables}
        else:
            migrate_output = 'Tables already exist'
            result2 = result

        output = {
            'before': result,
            'after': result2,
            'all_ok': all(result2.values()),
            'migrate_output': migrate_output,
        }

        out_path = os.path.join(settings.MEDIA_ROOT, 'shedding_check.json')
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w') as f:
            json.dump(output, f, indent=2)

        self.stdout.write(f"Written to {out_path}")
        self.stdout.write(json.dumps(output, indent=2))
