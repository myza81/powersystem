import re
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import (
    NetworkSnapshot,
    SnapshotBusState,
    NetworkLoad,
    LoadTransformer,
    TopologyBranch,
    IncomingBranch,
    TopologyTransformer,
    AutoTransformer,
)


class Command(BaseCommand):
    help = 'Populate bay master tables from topology (one-time helper)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--snapshot',
            type=str,
            help='NetworkSnapshot ID (defaults to latest)',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Required for non-dry run execution',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show counts without writing to DB',
        )

    def handle(self, *args, **kwargs):
        snapshot_id = kwargs.get('snapshot')
        dry_run = kwargs.get('dry_run', False)
        confirm = kwargs.get('confirm', False)

        if snapshot_id:
            snapshot = NetworkSnapshot.objects.filter(id=snapshot_id).first()
        else:
            snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()

        if not snapshot:
            self.stdout.write(self.style.ERROR('No NetworkSnapshot found.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f'Using NetworkSnapshot: {snapshot.id} ({snapshot.name})'
        ))

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run enabled: no data will be written.'))
        elif not confirm:
            self.stdout.write(self.style.ERROR('Refusing to run without --confirm. Use --dry-run to preview.'))
            return

        bus_to_substation = dict(
            SnapshotBusState.objects.filter(snapshot=snapshot)
            .values_list('bus_id', 'bus__substation_id')
        )

        load_qs = NetworkLoad.objects.filter(
            snapshot=snapshot,
            load_id__istartswith='T'
        ).values_list('bus_id', 'load_id')

        branch_qs = TopologyBranch.objects.filter(
            topology_version=snapshot.topology_version
        ).select_related('from_bus__substation', 'to_bus__substation')

        transformer_qs = TopologyTransformer.objects.filter(
            topology_version=snapshot.topology_version
        ).select_related('from_bus__substation', 'to_bus__substation')

        existing_load = defaultdict(set)
        for lt in LoadTransformer.objects.select_related('substation'):
            existing_load[lt.substation_id].add(lt.transformer_no)
        next_load_no = defaultdict(int)
        for sub_id, nums in existing_load.items():
            next_load_no[sub_id] = max(nums) if nums else 0

        created_load = 0
        created_by_substation = defaultdict(int)
        skipped_existing = 0
        skipped_duplicate_load = 0
        created_branch = 0
        created_branch_by_substation = defaultdict(int)
        created_auto = 0
        created_auto_by_substation = defaultdict(int)

        def parse_transformer_no(ckt_id: str):
            if not ckt_id:
                return None
            match = re.search(r'\d+', ckt_id)
            if not match:
                return None
            try:
                return int(match.group(0))
            except ValueError:
                return None

        def allocate_no(sub_id: str, pool: defaultdict):
            pool[sub_id] += 1
            return pool[sub_id]

        with transaction.atomic():
            seen_load_keys = set()
            for bus_id, load_id in load_qs:
                substation_id = bus_to_substation.get(bus_id)
                if not substation_id:
                    continue
                load_key = (substation_id, str(load_id).strip())
                if load_key in seen_load_keys:
                    skipped_duplicate_load += 1
                    continue
                seen_load_keys.add(load_key)

                tx_no = parse_transformer_no(load_id)
                if tx_no is None:
                    tx_no = allocate_no(substation_id, next_load_no)
                elif tx_no in existing_load[substation_id]:
                    skipped_existing += 1
                    continue
                if not dry_run:
                    obj, created = LoadTransformer.objects.get_or_create(
                        substation_id=substation_id,
                        transformer_no=tx_no,
                    )
                    if created:
                        created_load += 1
                        created_by_substation[substation_id] += 1
                else:
                    created_load += 1
                    created_by_substation[substation_id] += 1
                existing_load[substation_id].add(tx_no)

            for br in branch_qs:
                from_sub = br.from_bus.substation
                to_sub = br.to_bus.substation
                if not from_sub or not to_sub:
                    continue
                if from_sub.substation_id == to_sub.substation_id:
                    continue

                for local_sub, remote_sub in ((from_sub, to_sub), (to_sub, from_sub)):
                    if not dry_run:
                        _, created = IncomingBranch.objects.get_or_create(
                            substation=local_sub,
                            to_substation=remote_sub,
                            ckt_id=br.ckt_id.strip(),
                        )
                        if created:
                            created_branch += 1
                            created_branch_by_substation[local_sub.substation_id] += 1
                    else:
                        created_branch += 1
                        created_branch_by_substation[local_sub.substation_id] += 1

            existing_auto = defaultdict(set)
            for at in AutoTransformer.objects.select_related('substation'):
                existing_auto[at.substation_id].add(at.transformer_no)
            next_auto_no = defaultdict(int)
            for sub_id, nums in existing_auto.items():
                next_auto_no[sub_id] = max(nums) if nums else 0

            def parse_tx_no_from_ckt(ckt_id: str):
                return parse_transformer_no(ckt_id)

            for tx in transformer_qs:
                from_sub = tx.from_bus.substation
                to_sub = tx.to_bus.substation
                if not from_sub or not to_sub:
                    continue
                if from_sub.substation_id == to_sub.substation_id:
                    continue

                if from_sub.substation_id.startswith(to_sub.substation_id[:4]) or to_sub.substation_id.startswith(from_sub.substation_id[:4]):
                    local_sub = from_sub if from_sub.voltage >= to_sub.voltage else to_sub
                else:
                    continue

                hv_kv = int(round(max(tx.nomv1, tx.nomv2))) if tx.nomv2 else int(round(tx.nomv1))
                lv_kv = int(round(min(tx.nomv1, tx.nomv2))) if tx.nomv2 else None
                if lv_kv not in (275, 132):
                    continue

                tx_no = parse_tx_no_from_ckt(tx.ckt_id)
                if tx_no is None:
                    tx_no = allocate_no(local_sub.substation_id, next_auto_no)
                elif tx_no in existing_auto[local_sub.substation_id]:
                    continue

                if not dry_run:
                    _, created = AutoTransformer.objects.get_or_create(
                        substation=local_sub,
                        transformer_no=tx_no,
                        defaults={
                            'hv_voltage': local_sub.voltage,
                            'lv_voltage': lv_kv,
                            'capacity_mva': int(round(tx.rate_a)) if tx.rate_a else None,
                        }
                    )
                    if created:
                        created_auto += 1
                        created_auto_by_substation[local_sub.substation_id] += 1
                else:
                    created_auto += 1
                    created_auto_by_substation[local_sub.substation_id] += 1
                existing_auto[local_sub.substation_id].add(tx_no)

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f'Created LoadTransformers: {created_load}'
        ))
        if skipped_existing or skipped_duplicate_load:
            self.stdout.write(self.style.WARNING(
                f'Skipped existing: {skipped_existing}, skipped duplicate load_id: {skipped_duplicate_load}'
            ))
        if created_by_substation:
            self.stdout.write('LoadTransformers by substation:')
            for sub_id in sorted(created_by_substation.keys()):
                self.stdout.write(f'  {sub_id}: {created_by_substation[sub_id]}')

        self.stdout.write(self.style.SUCCESS(
            f'Created IncomingBranches: {created_branch}'
        ))
        if created_branch_by_substation:
            self.stdout.write('IncomingBranches by substation:')
            for sub_id in sorted(created_branch_by_substation.keys()):
                self.stdout.write(f'  {sub_id}: {created_branch_by_substation[sub_id]}')

        self.stdout.write(self.style.SUCCESS(
            f'Created AutoTransformers: {created_auto}'
        ))
        if created_auto_by_substation:
            self.stdout.write('AutoTransformers by substation:')
            for sub_id in sorted(created_auto_by_substation.keys()):
                self.stdout.write(f'  {sub_id}: {created_auto_by_substation[sub_id]}')
