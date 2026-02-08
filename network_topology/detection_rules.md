# Network Topology - Detection Rules (Updated)

**Version**: 1.1  
**Last Updated**: 2026-02-08  
**Change**: Corrected tee-off confidence scoring

---

## Detection Patterns & Confidence Levels

### Pattern 1: Standard Single Connection
**Confidence**: 0.95  
**Auto-validate**: Yes

```
SRDN1 → SRDN132 (exact mnemonic match)
GPTH2 → GPTH132 (exact mnemonic match)
BTGA1 → BTGA132 (exact mnemonic match)
```

**Logic**:
1. Extract mnemonic by removing trailing numbers: `SRDN1` → `SRDN`
2. Find substations with matching mnemonic (excluding self)
3. If exactly 1 match found → confidence 0.95

---

### Pattern 2: Tee-Off Connections (Slash Notation)
**Confidence**: 0.95 (if all parts resolve)  
**Auto-validate**: Yes (if high confidence)

```
NRWG/HKCK → NRWG132 + HKCK132
CBPS2/PMRN → CBPS132 + PMRN132
TPGR1/PIDH2 → TPGR132 + PIDH132
```

**Logic**:
1. Split on `/`: `NRWG/HKCK` → `['NRWG', 'HKCK']`
2. Extract mnemonic from each part
3. Find substations for each mnemonic
4. **If all parts resolve to exactly 1 substation each** → confidence 0.95
5. **If any part is ambiguous or not found** → confidence 0.50 (requires validation)

**Key Change**: Tee-offs with successful resolution are treated as standard connections with high confidence!

---

### Pattern 3: Autotransformers
**Confidence**: 0.99  
**Auto-validate**: Yes

```
SGT1, SGT2, SGT3 → Internal connection (same substation)
XGT1, YGT1 → Internal connection (same substation)
```

**Logic**:
1. Check if bay name starts with known patterns: `['SGT', 'XGT', 'YGT', 'AGT']`
2. If match → autotransformer (internal connection)

---

### Pattern 4: Ambiguous Cases
**Confidence**: 0.30-0.50  
**Auto-validate**: No (requires manual validation)

**Case 4a: Multiple Mnemonic Matches**
```
SRDN1 → Multiple substations with mnemonic 'SRDN' found
```

**Case 4b: Partial Tee-Off Resolution**
```
NRWG/HKCK → NRWG132 found, but HKCK not found
```

**Case 4c: No Match Found**
```
ABCD1 → No substation with mnemonic 'ABCD'
```

---

### Pattern 5: Exclusions
**Confidence**: 0.0  
**Auto-validate**: No (marked as UNKNOWN)

```
Capbank, Reactor, SVC, STATCOM, Shunt → Equipment, not connections
```

---

## Updated Confidence Thresholds

| Confidence | Action | Examples |
|------------|--------|----------|
| ≥0.95 | **Auto-validate** | Single exact match, fully-resolved tee-offs, autotransformers |
| 0.50-0.94 | **Suggest, require approval** | Partial tee-off resolution |
| <0.50 | **Reject, manual input** | No match, multiple ambiguous matches |

---

## Implementation Changes

### Updated detect_tee_off() Method

```python
@classmethod
def detect_tee_off(cls, bay_name, incoming_bay):
    """
    Tee-off detection with high confidence if all parts resolve
    """
    parts = bay_name.split('/')
    connected_substations = []
    unresolved_parts = []
    
    for part in parts:
        part = cls.clean_transformer_suffix(part)
        mnemonic = cls.extract_mnemonic(part)
        
        substations = Substation.objects.filter(
            mnemonic=mnemonic
        ).exclude(
            substation_id=incoming_bay.substation.substation_id
        )
        
        if substations.count() == 1:
            connected_substations.append(substations.first())
        else:
            unresolved_parts.append(mnemonic)
    
    # All parts resolved successfully
    if len(connected_substations) == len(parts) and len(parts) >= 2:
        return {
            'type': 'TEE_OFF',
            'primary': connected_substations[0],
            'tee_offs': connected_substations,
            'confidence': 0.95,  # HIGH CONFIDENCE - auto-validate
            'note': f"Tee-off: {' + '.join([s.substation_id for s in connected_substations])}"
        }
    
    # Partial resolution
    elif len(connected_substations) >= 1:
        return {
            'type': 'TEE_OFF',
            'primary': connected_substations[0] if connected_substations else None,
            'tee_offs': connected_substations,
            'confidence': 0.50,  # MEDIUM - requires validation
            'note': f"Partial tee-off: {len(connected_substations)}/{len(parts)} resolved. Unresolved: {', '.join(unresolved_parts)}"
        }
    
    # No resolution
    else:
        return {
            'type': 'UNKNOWN',
            'primary': None,
            'tee_offs': [],
            'confidence': 0.0,
            'note': f"Tee-off parse failed: {', '.join(unresolved_parts)}"
        }
```

---

## Expected Detection Rates (Updated)

| Pattern | % of Data | Detection Rate | Auto-Validate |
|---------|-----------|----------------|---------------|
| Standard Single | 60% | 95% | ✅ Yes |
| Tee-Off (Full Resolution) | 15% | 95% | ✅ Yes |
| Autotransformers | 10% | 99% | ✅ Yes |
| Tee-Off (Partial) | 5% | 50% | ❌ No |
| Special Cases | 10% | 20% | ❌ No |

**Overall Auto-Validation Rate**: ~85-90% (increased from previous estimate)

---

**Last Updated**: 2026-02-08  
**Revision**: 1.1 - Corrected tee-off confidence scoring
