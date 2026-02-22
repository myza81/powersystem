from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import LoadTransformer


class Command(BaseCommand):
    help = 'Populate HV breaker numbers for 132kV load transformers (one-time helper)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show counts without writing to DB',
        )

    def handle(self, *args, **kwargs):
        dry_run = kwargs.get('dry_run', False)

        qs = LoadTransformer.objects.filter(
            substation__voltage=132,
            hv_breaker_number__isnull=True,
        ).select_related('substation')

        updated = 0
        with transaction.atomic():
            for lt in qs:
                if not lt.transformer_no:
                    continue
                lt.hv_breaker_number = f"{lt.transformer_no}10"
                if not dry_run:
                    lt.save(update_fields=['hv_breaker_number'])
                updated += 1

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f'Updated HV breaker numbers: {updated}'
        ))
