"""
PSS/E .raw File Import Service V2

Parses PSS/E .raw files and populates the Network-centric V2 schema.
Handles all 11 populated data sections with bulk operations and transaction safety.
"""

import re
import logging
from typing import Dict, List, Tuple, Optional
from django.db import transaction
from core.models import (
    NetworkSnapshot,
    NetworkArea,
    NetworkZone,
    NetworkOwner,
    NetworkBus,
    NetworkBranch,
    NetworkTransformer,
    NetworkLoad,
    NetworkGenerator,
    NetworkShunt,
    NetworkSwitchedShunt,
    NetworkDCLink,
    Substation
)

logger = logging.getLogger(__name__)


class ImportServiceV2:
    """
    Service for importing PSS/E .raw files into V2 schema.
    
    Usage:
        snapshot = ImportServiceV2.import_raw_file('path/to/file.raw', 'Snapshot Name')
    """
    
    @classmethod
    def import_raw_file(cls, file_path: str, snapshot_name: str, description: str = '', user=None) -> NetworkSnapshot:
        """
        Import a complete .raw file into a new NetworkSnapshot.
        
        Args:
            file_path: Path to .raw file
            snapshot_name: Name for the snapshot
            description: Optional description
            user: User object to assign ownership
            
        Returns:
            Created NetworkSnapshot instance
        """
        logger.info(f"Starting import of {file_path}")
        
        with open(file_path, 'r') as f:
            lines = [line.rstrip('\r\n') for line in f.readlines()]
        
        # Parse case identification (first 3 lines)
        case_id_line = lines[0] if len(lines) > 0 else ''
        base_mva = 100.0  # Default
        frequency = 50.0  # Default
        
        # Try to extract SBASE from line 1
        # Format: IC, SBASE, REV, XFRRAT, NXFRAT, BASFRQ
        parts = case_id_line.split(',')
        if len(parts) >= 2:
            try:
                base_mva = float(parts[1].strip())
            except:
                pass
        if len(parts) >= 6:
            try:
                frequency = float(parts[5].strip())
            except:
                pass
        
        # Create snapshot
        with transaction.atomic():
            snapshot = NetworkSnapshot.objects.create(
                name=snapshot_name,
                description=description,
                base_mva=base_mva,
                frequency=frequency,
                created_by=user
            )
            
            logger.info(f"Created snapshot: {snapshot.name} (ID: {snapshot.id})")
            
            # Parse sections
            sections = cls._split_into_sections(lines)
            
            # Import in dependency order
            cls._import_areas(snapshot, sections.get('AREA', []))
            cls._import_zones(snapshot, sections.get('ZONE', []))
            cls._import_owners(snapshot, sections.get('OWNER', []))
            cls._import_buses(snapshot, sections.get('BUS', []))
            cls._import_loads(snapshot, sections.get('LOAD', []))
            cls._import_generators(snapshot, sections.get('GENERATOR', []))
            cls._import_shunts(snapshot, sections.get('FIXED SHUNT', []))
            cls._import_switched_shunts(snapshot, sections.get('SWITCHED SHUNT', []))
            cls._import_branches(snapshot, sections.get('BRANCH', []))
            cls._import_transformers(snapshot, sections.get('TRANSFORMER', []))
            cls._import_dc_links(snapshot, sections.get('TWO-TERMINAL DC', []))
            
            logger.info(f"Import complete for snapshot {snapshot.name}")
            return snapshot
    
    @classmethod
    def _split_into_sections(cls, lines: List[str]) -> Dict[str, List[str]]:
        """
        Split raw file lines into sections based on delimiters.
        
        Returns:
            Dict mapping section name to list of data lines
        """
        sections = {}
        current_section = None
        current_lines = []
        
        for line in lines:
            # Check for section delimiter (lines starting with "0 /")
            if line.startswith('0 /'):
                # Save previous section
                if current_section and current_lines:
                    sections[current_section] = current_lines
                
                # Determine new section
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
                # Skip comment lines starting with @!
                current_lines.append(line)
        
        return sections
    
    @classmethod
    def _import_areas(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """Import Area data."""
        areas = []
        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) >= 2:
                areas.append(NetworkArea(
                    snapshot=snapshot,
                    number=cls._safe_int(parts[0]),
                    name=parts[4] if len(parts) > 4 else ''
                ))
        
        NetworkArea.objects.bulk_create(areas, ignore_conflicts=True)
        logger.info(f"Imported {len(areas)} areas")
    
    @classmethod
    def _import_zones(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """Import Zone data."""
        zones = []
        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) >= 2:
                zones.append(NetworkZone(
                    snapshot=snapshot,
                    number=cls._safe_int(parts[0]),
                    name=parts[1]
                ))
        
        NetworkZone.objects.bulk_create(zones, ignore_conflicts=True)
        logger.info(f"Imported {len(zones)} zones")
    
    @classmethod
    def _import_owners(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """Import Owner data."""
        owners = []
        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) >= 2:
                owners.append(NetworkOwner(
                    snapshot=snapshot,
                    number=cls._safe_int(parts[0]),
                    name=parts[1]
                ))
        
        NetworkOwner.objects.bulk_create(owners, ignore_conflicts=True)
        logger.info(f"Imported {len(owners)} owners")
    
    @classmethod
    def _import_buses(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """
        Import Bus data and link to Substations.
        
        Bus format (PSS/E v33):
        I, 'NAME', BASKV, IDE, AREA, ZONE, OWNER, VM, VA
        """
        # Pre-load reference data
        areas = {a.number: a for a in NetworkArea.objects.filter(snapshot=snapshot)}
        zones = {z.number: z for z in NetworkZone.objects.filter(snapshot=snapshot)}
        owners = {o.number: o for o in NetworkOwner.objects.filter(snapshot=snapshot)}
        # Pre-load reference data
        from collections import defaultdict
        substations_by_mnemonic = defaultdict(list)
        for s in Substation.objects.all():
            substations_by_mnemonic[s.mnemonic].append(s)
            
        unmatched_mnemonics = {}  # Track unmatched mnemonics for secondary analysis
        
        buses = []
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
            
            # Link to substation via mnemonic matching + voltage disambiguation
            mnemonic = cls._extract_mnemonic(bus_name)
            substation = None
            if mnemonic in substations_by_mnemonic:
                potential_subs = substations_by_mnemonic[mnemonic]
                if len(potential_subs) == 1:
                    substation = potential_subs[0]
                else:
                    # Multi-voltage substation: match by voltage
                    # Find substation with minimum voltage difference
                    substation = min(potential_subs, key=lambda s: abs(float(s.voltage) - base_kv))
                    # Validate that it's a reasonable match (within 5kV)
                    if abs(float(substation.voltage) - base_kv) > 5.0:
                        # Fallback for name variants (e.g. BNTS275 matching BNTS 275)
                        substation = next((s for s in potential_subs if s.substation_id in bus_name), potential_subs[0])
            
            # Track unmatched mnemonics (only for transmission-level buses: 500, 275, 132 kV)
            # Exclude distribution-level buses (33, 22, 11 kV) and already matched buses
            if mnemonic and not substation and bus_name.strip():
                if base_kv in [500.0, 275.0, 132.0]:  # Only transmission-level
                    if mnemonic not in unmatched_mnemonics:
                        unmatched_mnemonics[mnemonic] = []
                    unmatched_mnemonics[mnemonic].append((bus_number, bus_name, base_kv))
            
            buses.append(NetworkBus(
                snapshot=snapshot,
                substation=substation,
                bus_number=bus_number,
                bus_name=bus_name,
                base_kv=base_kv,
                bus_type=ide_code,
                psse_area=areas.get(area_num),
                psse_zone=zones.get(zone_num),
                psse_owner=owners.get(owner_num),
                voltage_mag=voltage_mag,
                voltage_angle=voltage_angle
            ))
        
        NetworkBus.objects.bulk_create(buses, batch_size=1000)
        linked_count = sum(1 for b in buses if b.substation)
        
        # Log results
        logger.info(f"Imported {len(buses)} buses ({linked_count} linked to substations)")
        if unmatched_mnemonics:
            logger.warning(f"Found {len(unmatched_mnemonics)} unmatched mnemonics: {sorted(unmatched_mnemonics.keys())}")
            # Store unmatched mnemonics in snapshot metadata for frontend alerts
            snapshot.metadata = snapshot.metadata or {}
            snapshot.metadata['unmatched_mnemonics'] = {
                mnem: [{'bus_number': b[0], 'bus_name': b[1], 'voltage': b[2]} for b in buses_list]
                for mnem, buses_list in unmatched_mnemonics.items()
            }
            snapshot.save()
    
    @classmethod
    def _extract_mnemonic(cls, bus_name: str) -> Optional[str]:
        """
        Extract substation mnemonic from bus name.
        Returns None for fictitious/temporary buses.
        
        Example: "SDAO132" -> "SDAO", "PME275" -> "PME"
        Filters: "SDAOFIC" -> None (fictitious)
        """
        if not bus_name or not bus_name.strip():
            return None
        
        # Filter out fictitious/temporary buses
        if re.search(r'(FIC|TEMP|TMP|FICT)', bus_name, re.IGNORECASE):
            return None
        
        # Extract mnemonic (uppercase letters before numbers/symbols)
        match = re.match(r'([A-Z]+)', bus_name.strip())
        return match.group(1) if match else None
    
    @classmethod
    def _import_loads(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """
        Import Load data.
        Format: I, 'ID', STATUS, AREA, ZONE, PL, QL
        """
        buses = {b.bus_number: b for b in NetworkBus.objects.filter(snapshot=snapshot)}
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
                    in_service=(status == 1)
                ))
        
        NetworkLoad.objects.bulk_create(loads, batch_size=1000)
        logger.info(f"Imported {len(loads)} loads")
    
    @classmethod
    def _import_generators(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """
        Import Generator data.
        Format: I, 'ID', PG, QG, QT, QB, VS, ...
        """
        buses = {b.bus_number: b for b in NetworkBus.objects.filter(snapshot=snapshot)}
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
                    in_service=(status == 1)
                ))
        
        NetworkGenerator.objects.bulk_create(generators, batch_size=1000)
        logger.info(f"Imported {len(generators)} generators")
    
    @classmethod
    def _import_shunts(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """Import Fixed Shunt data."""
        buses = {b.bus_number: b for b in NetworkBus.objects.filter(snapshot=snapshot)}
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
                    in_service=(status == 1)
                ))
        
        NetworkShunt.objects.bulk_create(shunts)
        logger.info(f"Imported {len(shunts)} fixed shunts")
    
    @classmethod
    def _import_switched_shunts(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """Import Switched Shunt data."""
        buses = {b.bus_number: b for b in NetworkBus.objects.filter(snapshot=snapshot)}
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
                    step_info=''  # Simplified for now
                ))
        
        NetworkSwitchedShunt.objects.bulk_create(switched_shunts)
        logger.info(f"Imported {len(switched_shunts)} switched shunts")
    
    @classmethod
    def _safe_float(cls, value: str, default: float = 0.0) -> float:
        """Safely convert string to float, handling whitespace and empty strings."""
        try:
            stripped = value.strip()
            return float(stripped) if stripped else default
        except (ValueError, AttributeError):
            return default
    
    @classmethod
    def _safe_int(cls, value: str, default: int = 0) -> int:
        """Safely convert string to int, handling whitespace and empty strings."""
        try:
            stripped = value.strip()
            return int(stripped) if stripped else default
        except (ValueError, AttributeError):
            return default
    
    @classmethod
    def _import_branches(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """
        Import Branch (transmission line) data.
        Format: I, J, 'CKT', R, X, B, RATEA, RATEB, RATEC, ...
        """
        buses = {b.bus_number: b for b in NetworkBus.objects.filter(snapshot=snapshot)}
        branches = []
        
        for line in lines:
            if not line.strip():
                continue
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 12:
                continue
            
            from_bus_num = cls._safe_int(parts[0])
            to_bus_num = cls._safe_int(parts[1])
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
            
            from_bus = buses.get(from_bus_num)
            to_bus = buses.get(to_bus_num)
            
            if from_bus and to_bus:
                branches.append(NetworkBranch(
                    snapshot=snapshot,
                    from_bus=from_bus,
                    to_bus=to_bus,
                    ckt_id=ckt_id,
                    r=r,
                    x=x,
                    b=b,
                    rate_a=rate_a,
                    rate_b=rate_b,
                    rate_c=rate_c,
                    is_active=(status == 1)
                ))
        
        NetworkBranch.objects.bulk_create(branches, batch_size=1000)
        logger.info(f"Imported {len(branches)} branches")
    
    @classmethod
    def _import_transformers(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """
        Import Transformer data (2-winding only for now).
        PSS/E transformers span multiple lines. Simplified parsing.
        """
    @classmethod
    def _import_transformers(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """
        PSS/E transformers span multiple lines (4 for 2-winding, 5 for 3-winding).
        """
        buses = {b.bus_number: b for b in NetworkBus.objects.filter(snapshot=snapshot)}
        transformers = []
        cleaned_lines = [line for line in lines if line.strip()]
        
        i = 0
        while i < len(cleaned_lines):
            line = cleaned_lines[i].strip()
            if not line:
                i += 1
                continue
            
            # Line 1: I, J, K, 'CKT', ...
            parts = [p.strip().strip("'") for p in line.split(',')]
            if len(parts) < 4:
                i += 1
                continue
            
            from_bus_num = cls._safe_int(parts[0])
            to_bus_num = cls._safe_int(parts[1])
            tertiary_bus_num = cls._safe_int(parts[2]) if parts[2] != '0' else 0
            ckt_id = parts[3]
            
            # Line 2: Impedances (R, X)
            r, x = 0.0, 0.0
            if i + 1 < len(cleaned_lines):
                line2 = cleaned_lines[i + 1].strip()
                parts2 = [p.strip() for p in line2.split(',')]
                r = cls._safe_float(parts2[0]) if len(parts2) > 0 else 0.0
                x = cls._safe_float(parts2[1]) if len(parts2) > 1 else 0.0
            
            # Line 3: Winding 1 data
            windv1, nomv1, rate_a = 1.0, 0.0, 0.0
            if i + 2 < len(cleaned_lines):
                line3 = cleaned_lines[i + 2].strip()
                parts3 = [p.strip() for p in line3.split(',')]
                windv1 = cls._safe_float(parts3[0]) if len(parts3) > 0 else 1.0
                nomv1 = cls._safe_float(parts3[1]) if len(parts3) > 1 else 0.0
                rate_a = cls._safe_float(parts3[3]) if len(parts3) > 3 else 0.0
            
            # Line 4: Winding 2 data
            windv2, nomv2 = 1.0, 0.0
            if i + 3 < len(cleaned_lines):
                line4 = cleaned_lines[i + 3].strip()
                parts4 = [p.strip() for p in line4.split(',')]
                windv2 = cls._safe_float(parts4[0]) if len(parts4) > 0 else 1.0
                nomv2 = cls._safe_float(parts4[1]) if len(parts4) > 1 else 0.0

            # Line 5: Winding 3 data (Only for 3-winding)
            windv3, nomv3 = None, None
            step = 4
            if tertiary_bus_num != 0:
                step = 5
                if i + 4 < len(cleaned_lines):
                    line5 = cleaned_lines[i + 4].strip()
                    parts5 = [p.strip() for p in line5.split(',')]
                    windv3 = cls._safe_float(parts5[0]) if len(parts5) > 0 else 1.0
                    nomv3 = cls._safe_float(parts5[1]) if len(parts5) > 1 else 0.0

            from_bus = buses.get(from_bus_num)
            to_bus = buses.get(to_bus_num)
            tertiary_bus = buses.get(tertiary_bus_num) if tertiary_bus_num != 0 else None
            
            if from_bus and to_bus:
                transformers.append(NetworkTransformer(
                    snapshot=snapshot,
                    from_bus=from_bus,
                    to_bus=to_bus,
                    tertiary_bus=tertiary_bus,
                    ckt_id=ckt_id,
                    r=r,
                    x=x,
                    windv1=windv1,
                    windv2=windv2,
                    windv3=windv3,
                    nomv1=nomv1,
                    nomv2=nomv2,
                    nomv3=nomv3,
                    rate_a=rate_a,
                    is_active=True
                ))
            
            i += step
        
        NetworkTransformer.objects.bulk_create(transformers, batch_size=1000)
        logger.info(f"Imported {len(transformers)} transformers")
    
    @classmethod
    def _import_dc_links(cls, snapshot: NetworkSnapshot, lines: List[str]):
        """Import Two-Terminal DC Line data."""
        dc_links = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
            
            # Line 1: 'NAME', MDC, RDC, SETVL, ...
            parts = [p.strip().strip("'\"") for p in line.split(',')]
            if len(parts) < 4:
                i += 1
                continue
            
            name = parts[0]
            setpoint_mw = cls._safe_float(parts[3]) if len(parts) > 3 and parts[3] else 0.0
            
            # Line 2: Rectifier data (IPR, ...)
            rect_bus = 0
            if i + 1 < len(lines):
                line2 = lines[i + 1].strip()
                parts2 = [p.strip() for p in line2.split(',')]
                rect_bus = cls._safe_int(parts2[0]) if len(parts2) > 0 and parts2[0] else 0
            
            # Line 3: Inverter data (IPI, ...)
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
                setpoint_mw=setpoint_mw
            ))
            
            i += 3  # DC links span 3 lines
        
        NetworkDCLink.objects.bulk_create(dc_links)
        logger.info(f"Imported {len(dc_links)} DC links")
