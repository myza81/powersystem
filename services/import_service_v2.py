"""
PSS/E .raw File Import Service V2

Parses PSS/E .raw files and populates the network schema with
global topology versions and snapshot-scoped load profiles.
"""

import hashlib
import logging
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd
from django.db import transaction
from django.utils import timezone

from core.models import (
    NetworkSnapshot,
    NetworkTopology,
    TopologyVersion,
    TopologyBus,
    TopologyBranch,
    TopologyTransformer,
    SnapshotBusState,
    NetworkLoad,
    NetworkGenerator,
    NetworkShunt,
    NetworkSwitchedShunt,
    NetworkDCLink,
    Substation,
    LoadTransformer,
    IncomingBranch,
    AutoTransformer,
    EquipmentTopologyMap,
    EquipmentSnapshotState,
)

logger = logging.getLogger(__name__)


class ImportServiceV2:
    """
    Service for importing PSS/E .raw files into V2 schema and
    load profile-only uploads (CSV/XLSX).
    """

    @classmethod
    def import_raw_file(
        cls,
        file_path: str,
        snapshot_name: str,
        description: str = '',
        user=None,
    ) -> NetworkSnapshot:
        logger.info(f"Starting import of {file_path}")

        with open(file_path, 'r') as f:
            lines = [line.rstrip('\r\n') for line in f.readlines()]

        case_id_line = lines[0] if len(lines) > 0 else ''
        base_mva = 100.0
        frequency = 50.0

        parts = case_id_line.split(',')
        if len(parts) >= 2:
            base_mva = cls._safe_float(parts[1], default=100.0)
        if len(parts) >= 6:
            frequency = cls._safe_float(parts[5], default=50.0)

        sections = cls._split_into_sections(lines)
        bus_records, unmatched_mnemonics = cls._parse_bus_records(sections.get('BUS', []))
        branch_records = cls._parse_branch_records(sections.get('BRANCH', []))
        transformer_records = cls._parse_transformer_records(sections.get('TRANSFORMER', []))

        signature = cls._compute_topology_signature(bus_records, branch_records, transformer_records)
        topology_version = cls._get_or_create_topology_version(
            signature=signature,
            snapshot_name=snapshot_name,
            bus_records=bus_records,
            branch_records=branch_records,
            transformer_records=transformer_records,
        )

        with transaction.atomic():
            snapshot = NetworkSnapshot.objects.create(
                name=snapshot_name,
                description=description,
                base_mva=base_mva,
                frequency=frequency,
                created_by=user,
                import_type='RAW_FULL',
                topology_version=topology_version,
            )

            if topology_version.created_from_snapshot_id is None:
                topology_version.created_from_snapshot = snapshot
                topology_version.save(update_fields=['created_from_snapshot'])

            logger.info(f"Created snapshot: {snapshot.name} (ID: {snapshot.id})")


            cls._create_bus_states(snapshot, topology_version, bus_records)
            cls._import_loads(snapshot, topology_version, sections.get('LOAD', []))
            cls._import_generators(snapshot, topology_version, sections.get('GENERATOR', []))
            cls._import_shunts(snapshot, topology_version, sections.get('FIXED SHUNT', []))
            cls._import_switched_shunts(snapshot, topology_version, sections.get('SWITCHED SHUNT', []))
            cls._import_dc_links(snapshot, sections.get('TWO-TERMINAL DC', []))
            cls._create_equipment_snapshot_state(snapshot, topology_version)

            if unmatched_mnemonics:
                snapshot.metadata = snapshot.metadata or {}
                snapshot.metadata['unmatched_mnemonics'] = {
                    mnem: [{'bus_number': b[0], 'bus_name': b[1], 'voltage': b[2]} for b in buses_list]
                    for mnem, buses_list in unmatched_mnemonics.items()
                }
                snapshot.save(update_fields=['metadata'])

            logger.info(f"Import complete for snapshot {snapshot.name}")
            return snapshot

    @classmethod
    def import_load_profile(
        cls,
        file_path: str,
        snapshot_name: str,
        description: str = '',
        user=None,
        topology_version_id: Optional[str] = None,
    ) -> Tuple[NetworkSnapshot, Dict[str, int]]:
        topology_version = cls._get_topology_version_or_latest(topology_version_id)
        if not topology_version:
            raise ValueError("No topology version available for load profile import.")

        df = cls._read_load_profile_dataframe(file_path)
        df = cls._normalize_load_profile_columns(df)

        missing_columns = [c for c in ('bus_number', 'p_mw', 'q_mvar') if c not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

        with transaction.atomic():
            snapshot = NetworkSnapshot.objects.create(
                name=snapshot_name,
                description=description,
                base_mva=100.0,
                frequency=50.0,
                created_by=user,
                import_type='LOAD_PROFILE_ONLY',
                topology_version=topology_version,
            )

            bus_states = []
            for bus in TopologyBus.objects.filter(topology_version=topology_version):
                bus_states.append(SnapshotBusState(
                    snapshot=snapshot,
                    bus=bus,
                    bus_type=1,
                    voltage_mag=1.0,
                    voltage_angle=0.0,
                ))
            if bus_states:
                SnapshotBusState.objects.bulk_create(bus_states, batch_size=1000)

            bus_map = {
                b.bus_number: b
                for b in TopologyBus.objects.filter(topology_version=topology_version)
            }

            loads = []
            skipped = 0

            for _, row in df.iterrows():
                bus_number = cls._safe_int(row.get('bus_number'))
                if not bus_number:
                    skipped += 1
                    continue

                bus = bus_map.get(bus_number)
                if not bus:
                    skipped += 1
                    continue

                load_id = row.get('load_id')
                load_id = str(load_id).strip() if load_id not in (None, '') else '1'

                p_mw = cls._safe_float(row.get('p_mw'))
                q_mvar = cls._safe_float(row.get('q_mvar'))
                in_service = row.get('in_service')
                if in_service in (None, ''):
                    in_service = True
                else:
                    in_service = bool(int(in_service)) if str(in_service).isdigit() else bool(in_service)

                loads.append(NetworkLoad(
                    snapshot=snapshot,
                    bus=bus,
                    load_id=load_id,
                    p_mw=p_mw,
                    q_mvar=q_mvar,
                    in_service=in_service,
                ))

            NetworkLoad.objects.bulk_create(loads, batch_size=1000)
            logger.info(f"Imported {len(loads)} load records; skipped {skipped}")

            summary = {
                'imported': len(loads),
                'skipped': skipped,
            }
            return snapshot, summary

    @classmethod
    def _read_load_profile_dataframe(cls, file_path: str) -> pd.DataFrame:
        if file_path.lower().endswith('.csv'):
            return pd.read_csv(file_path)
        if file_path.lower().endswith(('.xlsx', '.xls')):
            return pd.read_excel(file_path)
        raise ValueError("Unsupported load profile file type. Use CSV or XLSX.")

    @classmethod
    def _normalize_load_profile_columns(cls, df: pd.DataFrame) -> pd.DataFrame:
        columns = {c: str(c).strip().lower() for c in df.columns}
        df = df.rename(columns=columns)
        return df

    @classmethod
    def _get_topology_version_or_latest(cls, topology_version_id: Optional[str]) -> Optional[TopologyVersion]:
        if topology_version_id:
            return TopologyVersion.objects.filter(id=topology_version_id).first()
        return TopologyVersion.objects.order_by('-created_at').first()

    @classmethod
    def _get_or_create_topology_version(
        cls,
        signature: str,
        snapshot_name: str,
        bus_records: List[Dict[str, object]],
        branch_records: List[Dict[str, object]],
        transformer_records: List[Dict[str, object]],
    ) -> TopologyVersion:
        existing = TopologyVersion.objects.filter(signature=signature).first()
        if existing:
            return existing

        topology, _ = NetworkTopology.objects.get_or_create(name='National Topology')
        version_tag = timezone.now().strftime('%Y-%m-%d')
        topology_version = TopologyVersion.objects.create(
            topology=topology,
            version_tag=version_tag,
            signature=signature,
        )

        buses = []
        for record in bus_records:
            buses.append(TopologyBus(
                topology_version=topology_version,
                substation=record.get('substation'),
                bus_number=record['bus_number'],
                bus_name=record['bus_name'],
                base_kv=record['base_kv'],
                psse_area=record.get('psse_area'),
                psse_zone=record.get('psse_zone'),
                psse_owner=record.get('psse_owner'),
            ))

        TopologyBus.objects.bulk_create(buses, batch_size=1000)

        bus_map = {
            b.bus_number: b
            for b in TopologyBus.objects.filter(topology_version=topology_version)
        }

        branches = []
        for record in branch_records:
            from_bus = bus_map.get(record['from_bus'])
            to_bus = bus_map.get(record['to_bus'])
            if from_bus and to_bus:
                branches.append(TopologyBranch(
                    topology_version=topology_version,
                    from_bus=from_bus,
                    to_bus=to_bus,
                    ckt_id=record['ckt_id'],
                    r=record['r'],
                    x=record['x'],
                    b=record['b'],
                    rate_a=record['rate_a'],
                    rate_b=record['rate_b'],
                    rate_c=record['rate_c'],
                    is_active=record['is_active'],
                ))

        TopologyBranch.objects.bulk_create(branches, batch_size=1000)

        transformers = []
        for record in transformer_records:
            from_bus = bus_map.get(record['from_bus'])
            to_bus = bus_map.get(record['to_bus'])
            tertiary_bus = bus_map.get(record.get('tertiary_bus')) if record.get('tertiary_bus') else None
            if from_bus and to_bus:
                transformers.append(TopologyTransformer(
                    topology_version=topology_version,
                    from_bus=from_bus,
                    to_bus=to_bus,
                    tertiary_bus=tertiary_bus,
                    ckt_id=record['ckt_id'],
                    r=record['r'],
                    x=record['x'],
                    windv1=record['windv1'],
                    windv2=record['windv2'],
                    windv3=record.get('windv3'),
                    nomv1=record['nomv1'],
                    nomv2=record['nomv2'],
                    nomv3=record.get('nomv3'),
                    rate_a=record['rate_a'],
                    is_active=record['is_active'],
                ))

        TopologyTransformer.objects.bulk_create(transformers, batch_size=1000)

        cls._create_equipment_topology_maps(topology_version)

        logger.info(f"Created topology version {topology_version.id} from {snapshot_name}")
        return topology_version

    @classmethod
    def _parse_transformer_no(cls, ckt_id: str) -> Optional[int]:
        if not ckt_id:
            return None
        match = re.search(r'\d+', ckt_id)
        if not match:
            return None
        try:
            return int(match.group(0))
        except ValueError:
            return None

    @classmethod
    def _select_by_voltage(cls, transformers: List[object], lv_kv: int):
        matches = [t for t in transformers if not t.lv_voltage or t.lv_voltage == lv_kv]
        if len(matches) == 1:
            return matches[0]
        return None

    @classmethod
    def _create_equipment_topology_maps(cls, topology_version: TopologyVersion) -> None:
        incoming_lookup = {
            (b.substation_id, b.to_substation_id, b.ckt_id): b
            for b in IncomingBranch.objects.select_related('substation', 'to_substation')
        }

        load_by_substation = {}
        for lt in LoadTransformer.objects.select_related('substation'):
            load_by_substation.setdefault(lt.substation_id, []).append(lt)

        auto_by_substation = {}
        for at in AutoTransformer.objects.select_related('substation'):
            auto_by_substation.setdefault(at.substation_id, []).append(at)

        maps = []

        branches = TopologyBranch.objects.filter(topology_version=topology_version).select_related(
            'from_bus__substation', 'to_bus__substation'
        )
        for br in branches:
            from_sub = br.from_bus.substation
            to_sub = br.to_bus.substation
            if not from_sub or not to_sub:
                continue
            key = (from_sub.substation_id, to_sub.substation_id, br.ckt_id)
            if key in incoming_lookup:
                maps.append(EquipmentTopologyMap(
                    topology_version=topology_version,
                    equipment_type=EquipmentTopologyMap.EquipmentType.INCOMING_BRANCH,
                    incoming_branch=incoming_lookup[key],
                    topology_branch=br,
                ))
            reverse_key = (to_sub.substation_id, from_sub.substation_id, br.ckt_id)
            if reverse_key != key and reverse_key in incoming_lookup:
                maps.append(EquipmentTopologyMap(
                    topology_version=topology_version,
                    equipment_type=EquipmentTopologyMap.EquipmentType.INCOMING_BRANCH,
                    incoming_branch=incoming_lookup[reverse_key],
                    topology_branch=br,
                ))

        transformers = TopologyTransformer.objects.filter(topology_version=topology_version).select_related(
            'from_bus__substation', 'to_bus__substation'
        )
        for tx in transformers:
            if tx.from_bus.substation and tx.to_bus.substation:
                if tx.from_bus.substation_id != tx.to_bus.substation_id:
                    continue
            tx_no = cls._parse_transformer_no(tx.ckt_id)
            candidates = []
            if tx.from_bus.substation:
                candidates.append((tx.from_bus.substation, int(round(tx.to_bus.base_kv))))
            if tx.to_bus.substation and tx.to_bus.substation != tx.from_bus.substation:
                candidates.append((tx.to_bus.substation, int(round(tx.from_bus.base_kv))))

            for sub, lv_kv in candidates:
                sub_id = sub.substation_id
                if lv_kv in (33, 22, 11):
                    lt = None
                    if tx_no is not None:
                        lt = next((t for t in load_by_substation.get(sub_id, []) if t.transformer_no == tx_no), None)
                    if lt is None:
                        lt = cls._select_by_voltage(load_by_substation.get(sub_id, []), lv_kv)
                    if lt:
                        maps.append(EquipmentTopologyMap(
                            topology_version=topology_version,
                            equipment_type=EquipmentTopologyMap.EquipmentType.LOAD_TRANSFORMER,
                            load_transformer=lt,
                            topology_transformer=tx,
                        ))
                elif lv_kv in (275, 132):
                    at = None
                    if tx_no is not None:
                        at = next((t for t in auto_by_substation.get(sub_id, []) if t.transformer_no == tx_no), None)
                    if at is None:
                        at = cls._select_by_voltage(auto_by_substation.get(sub_id, []), lv_kv)
                    if at:
                        maps.append(EquipmentTopologyMap(
                            topology_version=topology_version,
                            equipment_type=EquipmentTopologyMap.EquipmentType.AUTO_TRANSFORMER,
                            auto_transformer=at,
                            topology_transformer=tx,
                        ))

        if maps:
            EquipmentTopologyMap.objects.bulk_create(maps, batch_size=1000, ignore_conflicts=True)

    @classmethod
    def _create_equipment_snapshot_state(cls, snapshot: NetworkSnapshot, topology_version: TopologyVersion) -> None:
        maps = EquipmentTopologyMap.objects.filter(topology_version=topology_version).select_related(
            'topology_branch',
            'topology_transformer',
            'load_transformer',
            'incoming_branch',
            'auto_transformer',
        )
        states = []
        for mapping in maps:
            if mapping.topology_branch:
                in_service = mapping.topology_branch.is_active
            elif mapping.topology_transformer:
                in_service = mapping.topology_transformer.is_active
            else:
                continue

            states.append(EquipmentSnapshotState(
                snapshot=snapshot,
                equipment_type=mapping.equipment_type,
                load_transformer=mapping.load_transformer,
                incoming_branch=mapping.incoming_branch,
                auto_transformer=mapping.auto_transformer,
                in_service=in_service,
                state_source='snapshot',
            ))

        if states:
            EquipmentSnapshotState.objects.bulk_create(states, batch_size=1000, ignore_conflicts=True)

    @classmethod
    def _create_bus_states(
        cls,
        snapshot: NetworkSnapshot,
        topology_version: TopologyVersion,
        bus_records: List[Dict[str, object]],
    ):
        bus_map = {
            b.bus_number: b
            for b in TopologyBus.objects.filter(topology_version=topology_version)
        }

        states = []
        for record in bus_records:
            bus = bus_map.get(record['bus_number'])
            if not bus:
                continue
            states.append(SnapshotBusState(
                snapshot=snapshot,
                bus=bus,
                bus_type=record['bus_type'],
                voltage_mag=record['voltage_mag'],
                voltage_angle=record['voltage_angle'],
                nv_hi=record.get('nv_hi'),
                nv_lo=record.get('nv_lo'),
            ))

        SnapshotBusState.objects.bulk_create(states, batch_size=1000)

    @classmethod
    def _split_into_sections(cls, lines: List[str]) -> Dict[str, List[str]]:
        sections = {}
        current_section = None
        current_lines = []

        for line in lines:
            if line.startswith('0 /'):
                if current_section and current_lines:
                    sections[current_section] = current_lines

                if 'BEGIN BUS DATA' in line:
                    current_section = 'BUS'
                elif 'BEGIN LOAD DATA' in line:
                    current_section = 'LOAD'
                elif 'BEGIN FIXED SHUNT DATA' in line:
                    current_section = 'FIXED SHUNT'
                elif 'BEGIN GENERATOR DATA' in line:
                    current_section = 'GENERATOR'
                elif 'BEGIN BRANCH DATA' in line:
                    current_section = 'BRANCH'
                elif 'BEGIN TRANSFORMER DATA' in line:
                    current_section = 'TRANSFORMER'
                elif 'BEGIN AREA DATA' in line:
                    current_section = 'AREA'
                elif 'BEGIN TWO-TERMINAL DC' in line:
                    current_section = 'TWO-TERMINAL DC'
                elif 'BEGIN ZONE DATA' in line:
                    current_section = 'ZONE'
                elif 'BEGIN OWNER DATA' in line:
                    current_section = 'OWNER'
                elif 'BEGIN SWITCHED SHUNT DATA' in line:
                    current_section = 'SWITCHED SHUNT'
                elif 'END OF' in line:
                    current_section = None

                current_lines = []
            elif current_section and not line.startswith('@!'):
                current_lines.append(line)

        return sections


    @classmethod
    def _parse_bus_records(cls, lines: List[str]) -> Tuple[List[Dict[str, object]], Dict[str, list]]:
        substations_by_mnemonic = {}
        for s in Substation.objects.all():
            substations_by_mnemonic.setdefault(s.mnemonic, []).append(s)

        unmatched_mnemonics = {}
        records = []

        for line in lines:
            if not line.strip():
                continue

            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 9:
                continue

            bus_number = cls._safe_int(parts[0])
            bus_name = parts[1]
            base_kv = cls._safe_float(parts[2])
            ide_code = cls._safe_int(parts[3]) if len(parts) > 3 and parts[3] else 1
            area_num = cls._safe_int(parts[4]) if len(parts) > 4 and parts[4] else 1
            zone_num = cls._safe_int(parts[5]) if len(parts) > 5 and parts[5] else 1
            owner_num = cls._safe_int(parts[6]) if len(parts) > 6 and parts[6] else 1
            voltage_mag = cls._safe_float(parts[7]) if len(parts) > 7 and parts[7] else 1.0
            voltage_angle = cls._safe_float(parts[8]) if len(parts) > 8 and parts[8] else 0.0

            mnemonic = cls._extract_mnemonic(bus_name)
            substation = None
            if mnemonic in substations_by_mnemonic:
                potential_subs = substations_by_mnemonic[mnemonic]
            else:
                # Try prefix matching (e.g. OLPTRHS matches OLPT)
                potential_subs = []
                for m, subs in substations_by_mnemonic.items():
                    if mnemonic and m and mnemonic.startswith(m) and len(m) >= 3:
                        potential_subs.extend(subs)

            if potential_subs:
                if len(potential_subs) == 1:
                    substation = potential_subs[0]
                else:
                    substation = min(potential_subs, key=lambda s: abs(float(s.voltage) - base_kv))
                    if abs(float(substation.voltage) - base_kv) > 5.0:
                        substation = next((s for s in potential_subs if s.substation_id in bus_name), potential_subs[0])

            if mnemonic and not substation and bus_name.strip():
                if base_kv in [500.0, 275.0, 132.0]:
                    unmatched_mnemonics.setdefault(mnemonic, []).append((bus_number, bus_name, base_kv))

            records.append({
                'bus_number': bus_number,
                'bus_name': bus_name,
                'base_kv': base_kv,
                'bus_type': ide_code,
                'psse_area': area_num,
                'psse_zone': zone_num,
                'psse_owner': owner_num,
                'voltage_mag': voltage_mag,
                'voltage_angle': voltage_angle,
                'substation': substation,
            })

        return records, unmatched_mnemonics

    @classmethod
    def _parse_branch_records(cls, lines: List[str]) -> List[Dict[str, object]]:
        records = []
        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 12:
                continue

            from_bus = cls._safe_int(parts[0])
            to_bus = cls._safe_int(parts[1])
            ckt_id = parts[2]
            r = cls._safe_float(parts[3])
            x = cls._safe_float(parts[4])
            b = cls._safe_float(parts[5])
            rate_a = cls._safe_float(parts[6])
            rate_b = cls._safe_float(parts[7])
            rate_c = cls._safe_float(parts[8])
            if len(parts) > 23:
                status = cls._safe_int(parts[23])
            elif len(parts) > 13:
                status = cls._safe_int(parts[13])
            else:
                status = 1

            records.append({
                'from_bus': from_bus,
                'to_bus': to_bus,
                'ckt_id': ckt_id,
                'r': r,
                'x': x,
                'b': b,
                'rate_a': rate_a,
                'rate_b': rate_b,
                'rate_c': rate_c,
                'is_active': status == 1,
            })

        return records

    @classmethod
    def _parse_transformer_records(cls, lines: List[str]) -> List[Dict[str, object]]:
        records = []
        cleaned_lines = [line for line in lines if line.strip()]

        i = 0
        while i < len(cleaned_lines):
            line = cleaned_lines[i].strip()
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 4:
                i += 1
                continue

            from_bus = cls._safe_int(parts[0])
            to_bus = cls._safe_int(parts[1])
            tertiary_bus = cls._safe_int(parts[2]) if parts[2] != '0' else 0
            ckt_id = parts[3]

            r, x = 0.0, 0.0
            if i + 1 < len(cleaned_lines):
                line2 = cleaned_lines[i + 1].strip()
                parts2 = [p.strip() for p in line2.split(',')]
                r = cls._safe_float(parts2[0]) if len(parts2) > 0 else 0.0
                x = cls._safe_float(parts2[1]) if len(parts2) > 1 else 0.0

            windv1, nomv1, rate_a = 1.0, 0.0, 0.0
            if i + 2 < len(cleaned_lines):
                line3 = cleaned_lines[i + 2].strip()
                parts3 = [p.strip() for p in line3.split(',')]
                windv1 = cls._safe_float(parts3[0]) if len(parts3) > 0 else 1.0
                nomv1 = cls._safe_float(parts3[1]) if len(parts3) > 1 else 0.0
                rate_a = cls._safe_float(parts3[3]) if len(parts3) > 3 else 0.0

            windv2, nomv2 = 1.0, 0.0
            if i + 3 < len(cleaned_lines):
                line4 = cleaned_lines[i + 3].strip()
                parts4 = [p.strip() for p in line4.split(',')]
                windv2 = cls._safe_float(parts4[0]) if len(parts4) > 0 else 1.0
                nomv2 = cls._safe_float(parts4[1]) if len(parts4) > 1 else 0.0

            windv3, nomv3 = None, None
            step = 4
            if tertiary_bus != 0:
                step = 5
                if i + 4 < len(cleaned_lines):
                    line5 = cleaned_lines[i + 4].strip()
                    parts5 = [p.strip() for p in line5.split(',')]
                    windv3 = cls._safe_float(parts5[0]) if len(parts5) > 0 else 1.0
                    nomv3 = cls._safe_float(parts5[1]) if len(parts5) > 1 else 0.0

            records.append({
                'from_bus': from_bus,
                'to_bus': to_bus,
                'tertiary_bus': tertiary_bus if tertiary_bus != 0 else None,
                'ckt_id': ckt_id,
                'r': r,
                'x': x,
                'windv1': windv1,
                'windv2': windv2,
                'windv3': windv3,
                'nomv1': nomv1,
                'nomv2': nomv2,
                'nomv3': nomv3,
                'rate_a': rate_a,
                'is_active': True,
            })

            i += step

        return records

    @classmethod
    def _import_loads(cls, snapshot: NetworkSnapshot, topology_version: TopologyVersion, lines: List[str]):
        buses = {b.bus_number: b for b in TopologyBus.objects.filter(topology_version=topology_version)}
        loads = []

        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 7:
                continue

            bus_num = cls._safe_int(parts[0])
            load_id = parts[1]
            status = cls._safe_int(parts[2]) if parts[2] else 1
            p_mw = cls._safe_float(parts[5]) if parts[5] else 0.0
            q_mvar = cls._safe_float(parts[6]) if parts[6] else 0.0

            bus = buses.get(bus_num)
            if bus:
                loads.append(NetworkLoad(
                    snapshot=snapshot,
                    bus=bus,
                    load_id=load_id,
                    p_mw=p_mw,
                    q_mvar=q_mvar,
                    in_service=(status == 1),
                ))

        NetworkLoad.objects.bulk_create(loads, batch_size=1000)

    @classmethod
    def _import_generators(cls, snapshot: NetworkSnapshot, topology_version: TopologyVersion, lines: List[str]):
        buses = {b.bus_number: b for b in TopologyBus.objects.filter(topology_version=topology_version)}
        generators = []

        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 15:
                continue

            bus_num = cls._safe_int(parts[0])
            gen_id = parts[1]
            p_gen = cls._safe_float(parts[2]) if parts[2] else 0.0
            q_gen = cls._safe_float(parts[3]) if parts[3] else 0.0
            q_max = cls._safe_float(parts[4]) if parts[4] else 0.0
            q_min = cls._safe_float(parts[5]) if parts[5] else 0.0
            status = cls._safe_int(parts[14]) if len(parts) > 14 and parts[14] else 1
            p_max = cls._safe_float(parts[8]) if len(parts) > 8 and parts[8] else 0.0
            p_min = cls._safe_float(parts[9]) if len(parts) > 9 and parts[9] else 0.0

            bus = buses.get(bus_num)
            if bus:
                generators.append(NetworkGenerator(
                    snapshot=snapshot,
                    bus=bus,
                    gen_id=gen_id,
                    p_gen=p_gen,
                    q_gen=q_gen,
                    p_max=p_max,
                    p_min=p_min,
                    q_max=q_max,
                    q_min=q_min,
                    in_service=(status == 1),
                ))

        NetworkGenerator.objects.bulk_create(generators, batch_size=1000)

    @classmethod
    def _import_shunts(cls, snapshot: NetworkSnapshot, topology_version: TopologyVersion, lines: List[str]):
        buses = {b.bus_number: b for b in TopologyBus.objects.filter(topology_version=topology_version)}
        shunts = []

        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 5:
                continue

            bus_num = cls._safe_int(parts[0])
            shunt_id = parts[1]
            status = cls._safe_int(parts[2]) if parts[2] else 1
            g_mw = cls._safe_float(parts[3]) if parts[3] else 0.0
            b_mvar = cls._safe_float(parts[4]) if parts[4] else 0.0

            bus = buses.get(bus_num)
            if bus:
                shunts.append(NetworkShunt(
                    snapshot=snapshot,
                    bus=bus,
                    shunt_id=shunt_id,
                    g_mw=g_mw,
                    b_mvar=b_mvar,
                    in_service=(status == 1),
                ))

        NetworkShunt.objects.bulk_create(shunts, batch_size=1000)

    @classmethod
    def _import_switched_shunts(cls, snapshot: NetworkSnapshot, topology_version: TopologyVersion, lines: List[str]):
        buses = {b.bus_number: b for b in TopologyBus.objects.filter(topology_version=topology_version)}
        switched_shunts = []

        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 10:
                continue

            bus_num = cls._safe_int(parts[0])
            control_mode = cls._safe_int(parts[1]) if parts[1] else 0
            b_init = cls._safe_float(parts[9]) if len(parts) > 9 and parts[9] else 0.0

            bus = buses.get(bus_num)
            if bus:
                switched_shunts.append(NetworkSwitchedShunt(
                    snapshot=snapshot,
                    bus=bus,
                    control_mode=control_mode,
                    b_init=b_init,
                    step_info='',
                ))

        NetworkSwitchedShunt.objects.bulk_create(switched_shunts, batch_size=1000)

    @classmethod
    def _import_dc_links(cls, snapshot: NetworkSnapshot, lines: List[str]):
        dc_links = []

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            parts = [p.strip().strip("'\"") for p in line.split(',')]
            if len(parts) < 4:
                i += 1
                continue

            name = parts[0]
            setpoint_mw = cls._safe_float(parts[3]) if len(parts) > 3 and parts[3] else 0.0

            rect_bus = 0
            if i + 1 < len(lines):
                line2 = lines[i + 1].strip()
                parts2 = [p.strip() for p in line2.split(',')]
                rect_bus = cls._safe_int(parts2[0]) if len(parts2) > 0 and parts2[0] else 0

            inv_bus = 0
            if i + 2 < len(lines):
                line3 = lines[i + 2].strip()
                parts3 = [p.strip() for p in line3.split(',')]
                inv_bus = cls._safe_int(parts3[0]) if len(parts3) > 0 and parts3[0] else 0

            dc_links.append(NetworkDCLink(
                snapshot=snapshot,
                name=name,
                rectifier_bus_number=rect_bus,
                inverter_bus_number=inv_bus,
                setpoint_mw=setpoint_mw,
            ))

            i += 3

        NetworkDCLink.objects.bulk_create(dc_links)

    @classmethod
    def _compute_topology_signature(
        cls,
        bus_records: List[Dict[str, object]],
        branch_records: List[Dict[str, object]],
        transformer_records: List[Dict[str, object]],
    ) -> str:
        bus_items = sorted(
            [
                f"{b['bus_number']}|{b['bus_name']}|{b['base_kv']}"
                for b in bus_records
            ]
        )
        branch_items = sorted(
            [
                f"{b['from_bus']}|{b['to_bus']}|{b['ckt_id']}|{b['r']}|{b['x']}|{b['b']}|{b['rate_a']}|{b['rate_b']}|{b['rate_c']}|{int(b['is_active'])}"
                for b in branch_records
            ]
        )
        transformer_items = sorted(
            [
                f"{t['from_bus']}|{t['to_bus']}|{t.get('tertiary_bus') or 0}|{t['ckt_id']}|{t['r']}|{t['x']}|{t['windv1']}|{t['windv2']}|{t.get('windv3') or 0}|{t['nomv1']}|{t['nomv2']}|{t.get('nomv3') or 0}|{t['rate_a']}|{int(t['is_active'])}"
                for t in transformer_records
            ]
        )

        payload = '\n'.join(bus_items + branch_items + transformer_items)
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    @classmethod
    def _extract_mnemonic(cls, bus_name: str) -> Optional[str]:
        if not bus_name or not bus_name.strip():
            return None
        # Exclude known fictitious/temporary markers, but allow TMPI
        if re.search(r'(FIC|TEMP|FICT)', bus_name, re.IGNORECASE):
            return None
        # Only block TMP if it's not followed by 'I' (Tampoi)
        if re.search(r'TMP(?!I)', bus_name, re.IGNORECASE):
            return None
        match = re.match(r'([A-Z]+)', bus_name.strip())
        return match.group(1) if match else None

    @classmethod
    def _safe_float(cls, value: object, default: float = 0.0) -> float:
        try:
            if value is None:
                return default
            stripped = str(value).strip()
            return float(stripped) if stripped else default
        except (ValueError, AttributeError):
            return default

    @classmethod
    def _safe_int(cls, value: object, default: int = 0) -> int:
        try:
            if value is None:
                return default
            stripped = str(value).strip()
            return int(stripped) if stripped else default
        except (ValueError, AttributeError):
            return default
