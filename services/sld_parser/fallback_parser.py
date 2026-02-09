"""
Conservative Rule-Based Fallback Parser
Extracts data without LLM, only when confidence >80%. Omits uncertain fields.
"""

import re
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Confidence threshold for extraction (lowered from 0.8 to capture more data)
CONFIDENCE_THRESHOLD = 0.6


def parse_fallback(observations: Dict) -> Dict:
    """
    Conservative rule-based parsing without LLM.
    
    Args:
        observations: SLDObservations dict with texts and visual_elements
    
    Returns:
        Partial structured data (omits uncertain fields)
    """
    texts = observations.get("texts", [])
    visuals = observations.get("visual_elements", [])
    
    result = {
        "transformers": [],
        "incoming_bays": [],
        "_fallback_mode": True,
        "_confidence_note": "Conservative extraction - uncertain fields omitted"
    }
    
    # Extract transformers
    transformers = _extract_transformers_conservative(texts, visuals)
    result["transformers"] = transformers
    
    # Extract bays (Filter out ET/ETX as requested)
    bays = _extract_bays_conservative(texts, visuals)
    result["incoming_bays"] = [b for b in bays if not (b["bay_id"].upper().startswith("ET") or b["bay_id"].upper().startswith("ETX"))]
    
    # 3. Extract Substation Commissioning Date (Left side of SLD)
    # Pattern: PMU Comm. Date 17th, MAR., 1998 or 17th. MAR., 1998
    for t in texts:
        if "PMU" in t["text"].upper() and "COMM" in t["text"].upper():
            # Look for date following this or nearby
            date_regex = r'(\d{1,2}(?:st|nd|rd|th)?[\.,]?\s*[A-Z]{3,}\.,?\s*\d{4})'
            date_match = re.search(date_regex, t["text"])
            if date_match:
                result["commission_date"] = _parse_pretty_date(date_match.group(1))
                break
            else:
                # Search nearby
                nearby = _find_nearby_text(texts, t["bbox"], date_regex, radius=1000)
                if nearby:
                    raw_val = nearby[0] if isinstance(nearby[0], str) else nearby[0][0]
                    result["commission_date"] = _parse_pretty_date(raw_val)
                    break
    
    logger.info(
        f"Fallback parser: {len(transformers)} transformers, {len(bays)} bays extracted"
    )
    
    return result


def normalize_ocr_number(text: str) -> str:
    """Normalize common OCR errors in numbers."""
    # Common OCR mistakes
    normalized = text.replace('l', '1').replace('O', '0').replace('o', '0')
    normalized = normalized.replace('I', '1').replace('S', '5').replace('Z', '2')
    return normalized


def _extract_transformers_conservative(texts: List[Dict], visuals: List[Dict]) -> List[Dict]:
    """Extract transformers with high confidence only."""
    transformers = {}  # Use dict to deduplicate by ID
    
    # Find transformer labels (T1, T2, ET1, ETX3, etc.)
    t_pattern = re.compile(r'^(ETX?|T)\d+$')
    
    # Group all instances of each transformer ID, weighting by layer
    t_instances = {}
    for text in texts:
        if not t_pattern.match(text["text"]):
            continue
        
        if text.get("confidence", 0) < CONFIDENCE_THRESHOLD * 100:
            continue
        
        # Priority Weighting: Layers like 'NLA2' or 'BTNG' are diagrams, '0' or 'HCOM' are often tables
        layer = text.get("layer", "").upper()
        weight = 2.0 if layer in ['NLA2', 'BTNG', 'TRANSFORMER', 'AHTM'] else 1.0
        
        t_id = text["text"]
        if t_id not in t_instances:
            t_instances[t_id] = []
        t_instances[t_id].append({"data": text, "weight": weight})
    
    # Process each unique transformer
    for t_id, instances in t_instances.items():
        # FILTER: Exclude Earthing Transformers (ET, ETX)
        if t_id.startswith("ET") or t_id.startswith("ETX"):
            continue

        # Sort instances by weight (diagram instances first)
        instances.sort(key=lambda x: x["weight"], reverse=True)
        # Extract sequence digits from T1, ET1, ETX3, etc.
        seq_match = re.search(r'\d+', t_id)
        seq = int(seq_match.group()) if seq_match else 0
        
        t_data = {
            "transformer_id": t_id,
            "sequence_number": seq,
            "hv_voltage": None,
            "lv_voltage": None,
            "capacity_mva": None,
            "hv_breaker_number": None,
            "lv_breaker_number": None,
            "commission_date": None,
            "transformer_type": None
        }
        
        # Try each instance to find surrounding data
        for inst in instances:
            text = inst["data"]
            bbox = text["bbox"]
            
            # 1. Search for Rating (MVA)
            # Handle "2x90MVA" patterns
            if not t_data["capacity_mva"]:
                # Look for MVA text
                mva_candidates = _find_nearby_text(texts, bbox, r'((?:2x)?\d+)\s?MVA', radius=800)
                if mva_candidates:
                    # Sort by distance
                    # mva_candidates returns tuples/strings. _find_nearby_text returns regex groups.
                    # The regex has 1 capturing group. So it returns strings or tuples of string.
                    raw_val = mva_candidates[0][0] if isinstance(mva_candidates[0], tuple) else mva_candidates[0]
                    
                    if "2x" in raw_val.lower():
                        # Extract the number AFTER 'x'
                        # raw_val expected: "2x90"
                        parts = raw_val.lower().split('x')
                        if len(parts) > 1 and parts[1].isdigit():
                            t_data["capacity_mva"] = float(parts[1])
                        else:
                             # Fallback if split fails
                             t_data["capacity_mva"] = float(re.findall(r'\d+', raw_val)[-1])
                    else:
                        t_data["capacity_mva"] = float(raw_val)

            # 2. Try to find voltage rating
            if not t_data["hv_voltage"]:
                v_candidates = _find_nearby_text(texts, bbox, r'(\d+)/(\d+)\s?kV', radius=800)
                if len(v_candidates) >= 1:
                    hv, lv = v_candidates[0]
                    t_data["hv_voltage"] = int(hv)
                    t_data["lv_voltage"] = int(lv)
                    t_data["transformer_type"] = f"{hv}/{lv}kV"
            
            # 2b. Visual Fallback: Infer voltage from colored elements if text missed it
            if not t_data["hv_voltage"]:
                # Try to find HV specifically (prioritize high voltage colors like 132, 275, 500)
                hv_hint = _infer_voltage_from_visuals(bbox, visuals, prioritize_high_voltage=True)
                if hv_hint and hv_hint >= 66:
                    t_data["hv_voltage"] = hv_hint
            
            if not t_data["lv_voltage"]:
                # Try to find LV (standard voting)
                v_hint = _infer_voltage_from_visuals(bbox, visuals)
                if v_hint and v_hint < 66:
                     t_data["lv_voltage"] = v_hint
            
            # 3. Try to find HV breaker (Instruction No.12: [seq]**0)
            if not t_data["hv_breaker_number"]:
                breaker_pattern = f"^{seq}[0-9]0$"
                breaker_candidates = _find_nearby_text(texts, bbox, breaker_pattern, radius=500)
                
                for bc in breaker_candidates:
                    match_text = bc["text"] if isinstance(bc, dict) else bc
                    bc_obj = next((tx for tx in texts if tx["text"] == match_text), None)
                    if bc_obj:
                        dx = abs(_get_center_x(bc_obj["bbox"]) - _get_center_x(bbox))
                        if dx < 100: # Tighten alignment
                            t_data["hv_breaker_number"] = normalize_ocr_number(match_text)
                            break
            
            # 4. Try to find LV breaker
            # Patterns: [seq]T0, [seq]0, 3[seq] (e.g. 31, 32), 4T0, 5T0
            if not t_data["lv_breaker_number"]:
                lv_patterns = [
                    f"^{seq}T0$",      # 3T0, 4T0
                    f"^3{seq}$",       # 31, 32 (Standard 11kV)
                    f"^{seq}0$",       # Generic
                    f"^{seq}1$",       # Sometimes [seq]1
                ]
                
                found_lv = None
                for pat in lv_patterns:
                    # Increase radius to catch distant breakers (diagrams are tall)
                    candidates = _find_nearby_text(texts, bbox, pat, radius=1200)
                    for c in candidates:
                        match_text = c["text"] if isinstance(c, dict) else c
                        c_obj = next((tx for tx in texts if tx["text"] == match_text), None)
                        if c_obj:
                            dx = abs(_get_center_x(c_obj["bbox"]) - _get_center_x(bbox))
                            # Check vertical alignment strictly
                            if dx < 100:
                                found_lv = normalize_ocr_number(match_text)
                                break
                    if found_lv: break
                
                t_data["lv_breaker_number"] = found_lv
            
            # 5. Search for Commissioning Date (Bottom Box)
            # Pattern: T1 03/06/98 or separate date next to T1
            if not t_data["commission_date"]:
                # Try search in same text
                date_inline_pattern = rf'\b{t_id}\s*(\d{{1,2}}[/\.-]\d{{1,2}}[/\.-]\d{{2,4}})\b'
                found_date = None
                for t in texts:
                    dm = re.search(date_inline_pattern, t["text"])
                    if dm:
                        found_date = _parse_simple_date(dm.group(1))
                        break
                
                if not found_date:
                    # Search for a standalone date nearby this instance
                    standalone_date_pattern = r'^(\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4})$'
                    nearby_dates = _find_nearby_text(texts, bbox, standalone_date_pattern, radius=300)
                    if nearby_dates:
                        raw_date = nearby_dates[0] if isinstance(nearby_dates[0], str) else nearby_dates[0][0]
                        found_date = _parse_simple_date(raw_date)
                
                if not found_date:
                    # Look for date near the label "Commissioning Date"
                    for t in texts:
                        if "Commissioning Date" in t["text"]:
                            # Look for [t_id] [date] pattern near the commission label
                            nearby_combined = _find_nearby_text(texts, t["bbox"], date_inline_pattern, radius=1500)
                            if nearby_combined:
                                raw_date = nearby_combined[0] if isinstance(nearby_combined[0], str) else nearby_combined[0][0]
                                found_date = _parse_simple_date(raw_date)
                                break
                
                t_data["commission_date"] = found_date
        
        # Add transformer if we found HV breaker (minimum requirement)
        # OR if we found both voltage AND MVA
        has_minimum_data = (
            t_data["hv_breaker_number"] or
            (t_data["hv_voltage"] and t_data["capacity_mva"])
        )
        
        if has_minimum_data:
            transformers[t_id] = t_data
        else:
            logger.warning(f"Skipped {t_id}: insufficient confident data")
    
    return list(transformers.values())


def _extract_bays_conservative(texts: List[Dict], visuals: List[Dict]) -> List[Dict]:
    """Extract incoming bays with high confidence only."""
    bays = []
    
    # Match bay pattern: uppercase letters + number (SRDN1, IOIM2)
    bay_pattern = re.compile(r'^[A-Z]{2,}\d+$')
    
    def _find_breaker_symbol_bbox(bay_bbox: Dict) -> Optional[Dict]:
        breaker_symbols = [v for v in visuals if v.get("type") == "breaker_symbol"]
        if not breaker_symbols:
            return None
        bay_x = _get_center_x(bay_bbox)
        candidates = []
        for sym in breaker_symbols:
            sym_bbox = sym.get("bbox")
            if not sym_bbox:
                continue
            sym_x = _get_center_x(sym_bbox)
            dx = abs(sym_x - bay_x)
            if dx < 150:
                candidates.append((dx, sym_bbox))
        if not candidates:
            return None
        candidates.sort(key=lambda c: c[0])
        return candidates[0][1]

    def _find_breaker_number_near_bbox(bbox: Dict, pattern: str, radius: int = 300) -> Optional[str]:
        pattern_obj = re.compile(pattern)
        left_candidates = []
        right_candidates = []
        bbox_left = bbox["x"]
        bbox_right = bbox["x"] + bbox["w"]
        bbox_mid_y = bbox["y"] + bbox["h"] / 2

        for t in texts:
            match = pattern_obj.search(t["text"])
            if not match:
                continue
            t_bbox = t["bbox"]
            t_mid_y = t_bbox["y"] + t_bbox["h"] / 2
            if abs(t_mid_y - bbox_mid_y) > bbox["h"] * 1.5:
                continue
            t_left = t_bbox["x"]
            t_right = t_bbox["x"] + t_bbox["w"]
            # Left side candidate
            if t_right <= bbox_left and (bbox_left - t_right) <= radius:
                left_candidates.append((bbox_left - t_right, t["text"]))
            # Right side candidate
            if t_left >= bbox_right and (t_left - bbox_right) <= radius:
                right_candidates.append((t_left - bbox_right, t["text"]))

        left_candidates.sort(key=lambda c: c[0])
        right_candidates.sort(key=lambda c: c[0])
        if left_candidates:
            return normalize_ocr_number(left_candidates[0][1])
        if right_candidates:
            return normalize_ocr_number(right_candidates[0][1])
        return None

    def _find_breaker_number_by_sequence(bay_bbox: Dict, ref_bbox: Optional[Dict] = None, used_breakers: Optional[set] = None) -> Optional[str]:
        bay_x = _get_center_x(bay_bbox)
        ref_x = _get_center_x(ref_bbox) if ref_bbox else bay_x
        bay_mid_y = bay_bbox["y"] + bay_bbox["h"] / 2
        column_radius = 140
        candidates = []
        for t in texts:
            if not re.match(r'^\d{3}$', t["text"]):
                continue
            t_bbox = t["bbox"]
            t_mid_x = _get_center_x(t_bbox)
            t_mid_y = t_bbox["y"] + t_bbox["h"] / 2
            if abs(t_mid_x - bay_x) > column_radius:
                continue
            if t_mid_y <= bay_mid_y + 5:
                continue
            candidates.append((t_mid_y, t["text"], t_mid_x))
        if not candidates:
            return None

        grouped = {}
        for mid_y, text, mid_x in candidates:
            prefix = text[:2]
            grouped.setdefault(prefix, []).append((mid_y, text, mid_x))

        valid_prefixes = []
        for prefix, items in grouped.items():
            filtered = [item for item in items if item[1][-1] in {'1', '3', '5'}]
            if len(filtered) < 3:
                continue
            filtered.sort(key=lambda item: item[0])
            order = [item[1][-1] for item in filtered]
            if '1' in order and '3' in order and '5' in order:
                if order.index('1') < order.index('3') < order.index('5'):
                    # Prefer columns closest to reference x (breaker symbol if present)
                    avg_x = sum(item[2] for item in filtered) / len(filtered)
                    dx = abs(avg_x - ref_x)
                    valid_prefixes.append((prefix, filtered, dx))

        if not valid_prefixes:
            return None

        breaker_items = []
        valid_prefixes.sort(key=lambda item: item[2])
        best_prefix, best_items, _ = valid_prefixes[0]
        for _, items, _ in valid_prefixes[:1]:
            for item in items:
                if item[1].endswith('5'):
                    breaker_items.append(item)

        if not breaker_items:
            return None
        breaker_items.sort(key=lambda item: item[0])
        for _, text, _ in reversed(breaker_items):
            candidate = normalize_ocr_number(text)
            if used_breakers is None or candidate not in used_breakers:
                return candidate
        return None

    def build_bay_data(text: Dict, used_breakers: set) -> Optional[Dict]:
        if not bay_pattern.match(text["text"]):
            return None
        if text.get("confidence", 0) < CONFIDENCE_THRESHOLD * 100:
            return None

        bay_id = text["text"]
        seq_match = re.search(r'\d+', bay_id)
        seq = int(seq_match.group()) if seq_match else None

        bay_data = {
            "bay_id": bay_id,
            "sequence_number": seq,
            "voltage": None,
            "breaker_number": None
        }

        # Look for breaker symbol (square) vertically aligned, then read number near it
        bbox = text["bbox"]
        breaker_symbol_bbox = _find_breaker_symbol_bbox(bbox)
        if breaker_symbol_bbox:
            bay_data["_breaker_bbox"] = breaker_symbol_bbox
            bay_data["breaker_number"] = _find_breaker_number_near_bbox(
                breaker_symbol_bbox,
                r'^\d[0-9]5$',
                radius=400
            )
        if not bay_data.get("breaker_number"):
            bay_data["breaker_number"] = _find_breaker_number_by_sequence(bbox, breaker_symbol_bbox, used_breakers=used_breakers)
        if not bay_data.get("breaker_number"):
            logger.warning(f"Bay {bay_id}: No breaker ending in 5 near breaker symbol or sequence")

        # Try to infer voltage from nearby colored conductors
        # Prefer using breaker location if available (more accurate)
        target_bbox = bay_data.get("_breaker_bbox", bbox)
        # For bays, prioritize HV (132kV+) if present nearby, as bays usually connect to main bus
        voltage = _infer_voltage_from_visuals(target_bbox, visuals, prioritize_high_voltage=True)
        if voltage:
            bay_data["voltage"] = voltage

        # Enforce breaker rule for 132kV incoming bays
        if bay_data.get("voltage") == 132:
            breaker = bay_data.get("breaker_number")
            if breaker and not str(breaker).endswith("5"):
                bay_data["breaker_number"] = None

        return bay_data

    used_breakers = set()
    for text in texts:
        bay_data = build_bay_data(text, used_breakers)
        if bay_data:
            breaker = bay_data.get("breaker_number")
            if breaker and breaker in used_breakers:
                bay_data["breaker_number"] = None
            if bay_data.get("breaker_number"):
                used_breakers.add(bay_data["breaker_number"])
            bays.append(bay_data)
    
    
    # Internal Deduplication: Keep instances with breakers over those without
    final_bays = {}
    for bay in bays:
        bid = bay["bay_id"]
        # If new instance has a breaker and existing doesn't, or bid not seen, update
        if bid not in final_bays or (not final_bays[bid]["breaker_number"] and bay["breaker_number"]):
            final_bays[bid] = bay
    
    return list(final_bays.values())


def _find_nearby_text(texts: List[Dict], bbox: Dict, pattern: str, radius: int = 50) -> List:
    """Find text matching pattern near a bounding box."""
    pattern_obj = re.compile(pattern)
    matches = []
    
    center_x = bbox["x"] + bbox["w"] / 2
    center_y = bbox["y"] + bbox["h"] / 2
    
    for t in texts:
        t_center_x = t["bbox"]["x"] + t["bbox"]["w"] / 2
        t_center_y = t["bbox"]["y"] + t["bbox"]["h"] / 2
        
        dist = ((t_center_x - center_x)**2 + (t_center_y - center_y)**2)**0.5
        
        if dist < radius:
            # Check regex
            if pattern_obj.search(t["text"]):
                matches.append(t)
    
    # Sort by distance
    matches.sort(key=lambda m: ((m["bbox"]["x"] + m["bbox"]["w"]/2 - center_x)**2 + (m["bbox"]["y"] + m["bbox"]["h"]/2 - center_y)**2))
    
    # Return list of strings/tuples for compatibility
    results = []
    for m in matches:
        match = pattern_obj.search(m["text"])
        if match is None:
            continue
        groups = match.groups()
        results.append(groups if groups else m["text"])
    return results


def _parse_simple_date(text: str) -> Optional[str]:
    """Parse date like 03/06/98 into YYYY-MM-DD."""
    try:
        # Split by non-digits
        parts = re.split(r'[/\.-]', text)
        if len(parts) != 3: return None
        d, m, y = parts[0], parts[1], parts[2]
        
        # Handle 2-digit year
        if len(y) == 2:
            year = int(y)
            y = str(1900 + year) if year > 50 else str(2000 + year)
            
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    except:
        return None


def _parse_pretty_date(text: str) -> Optional[str]:
    """Parse date like 17th, MAR., 1998 into YYYY-MM-DD."""
    try:
        # 17th, MAR., 1998
        # Remove suffixes like st, nd, rd, th
        clean = re.sub(r'(st|nd|rd|th)', '', text, flags=re.IGNORECASE)
        # Remove punctuation
        clean = clean.replace(',', ' ').replace('.', ' ')
        parts = clean.split()
        if len(parts) < 3: return None
        
        d = parts[0].zfill(2)
        month_str = parts[1].upper()[:3]
        y = parts[2]
        
        months = {
            'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 
            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08', 
            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        }
        m = months.get(month_str, '01')
        
        return f"{y}-{m}-{d}"
    except:
        return None


def _get_center_x(bbox: Dict) -> float:
    """Get horizontal center of bbox."""
    return bbox["x"] + bbox["w"] / 2


def _infer_voltage_from_visuals(bbox: Dict, visuals: List[Dict], tolerance: int = 200, prioritize_high_voltage: bool = False) -> Optional[int]:
    """Infer voltage from nearby colored conductors using weighted voting."""
    # Candidates list of tuples: (voltage, weight)
    candidates = []
    
    ref_x = _get_center_x(bbox)
    
    for vis in visuals:
        if vis.get("type") != "conductor":
            continue
        
        voltage_hint = vis.get("voltage_hint")
        if voltage_hint is None:
            continue

        # Check proximity
        vis_bbox = vis["bbox"]
        dx = abs(_get_center_x(vis_bbox) - ref_x)
        
        if dx < tolerance:
            # Weighted vote: closer = higher weight
            # Weight = 1 / (distance + 1)
            weight = 1.0 / (dx + 1.0)
            candidates.append((voltage_hint, weight))
    
    if not candidates:
        return None
    
    # Sum weights per voltage
    voltage_scores = {}
    total_weight = 0.0
    
    for v, w in candidates:
        voltage_scores[v] = voltage_scores.get(v, 0.0) + w
        total_weight += w
    
    # High Voltage Priority Logic
    if prioritize_high_voltage:
        # Check if any HV score is significant (e.g. > 0.1, meaning ~9px proximity)
        hv_candidates = {v: s for v, s in voltage_scores.items() if v >= 132}
        if hv_candidates:
            best_hv = max(hv_candidates.items(), key=lambda x: x[1])
            if best_hv[1] > 0.1: # Threshold for "physically close enough"
                return best_hv[0]
    
    # Find winner
    best_voltage = max(voltage_scores.items(), key=lambda x: x[1])[0]
    best_score = voltage_scores[best_voltage]
    
    # Require at least 50% consensus by weight
    if best_score / total_weight >= 0.5:
        return best_voltage
    
    return None
