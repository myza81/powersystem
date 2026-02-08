---
name: Network Topology Detection
description: Intelligent detection of substation connections from incoming bay names with strict validation and user oversight
---

# Network Topology Detection Skill

## Purpose

This skill provides intelligent detection of network topology (substation connections) from incoming bay naming patterns. It uses pattern matching algorithms with confidence scoring and requires user validation for ambiguous cases.

## When to Use This Skill

Use this skill when you need to:
- Detect which substations are connected via incoming bays
- Validate or update network topology data
- Analyze cascading effects of bay trips
- Prepare data for load shedding analysis
- Audit network connectivity

## Core Concepts

### Connection Types

1. **STANDARD**: Direct connection to another substation
   - Example: `SRDN1` at ABBA132 → connects to SRDN132
   
2. **TEE_OFF**: Connection to multiple substations
   - Example: `NRWG/HKCK` → connects to both NRWG132 and HKCK132
   
3. **AUTOTRANSFORMER**: Internal connection (same substation, different voltage)
   - Example: `SGT1`, `SGT2`, `SGT3` → internal transformers
   
4. **UNKNOWN**: Unable to detect, requires manual input

### Validation States

- **PENDING**: Awaiting user validation
- **VALIDATED**: User has confirmed connection
- **AUTO_VALIDATED**: High confidence auto-detection (≥0.95)
- **REJECTED**: Detection failed or user rejected

### Confidence Thresholds

- **≥0.95**: Auto-validate (exact matches, autotransformers)
- **0.70-0.94**: Suggest to user, require approval
- **<0.70**: Reject auto-detection, require manual input

## Key Files

```
network_topology/
├── implementation_plan.md    # Technical implementation details
├── risk_analysis.md          # Challenges and mitigation plans
├── task_plan.md              # Phase-by-phase task breakdown
└── SKILL.md                  # This file
```

## Usage Examples

### Example 1: Run Auto-Detection on All Bays

```python
from services.network_topology import NetworkTopologyService

# Run detection on all bays
results = NetworkTopologyService.auto_detect_all(confidence_threshold=0.95)

print(f"Auto-validated: {results['detected']}")
print(f"Pending review: {results['failed']}")
```

### Example 2: Detect Connection for Single Bay

```python
from core.models import IncomingBay
from services.network_topology import NetworkTopologyService

bay = IncomingBay.objects.get(bay_id='ABBA132_SRDN1')
detection = NetworkTopologyService.detect_connections(bay)

print(f"Type: {detection['type']}")
print(f"Connected to: {detection['primary']}")
print(f"Confidence: {detection['confidence']}")
print(f"Note: {detection['note']}")
```

### Example 3: Validate Pending Connections

```python
# Get all pending validations
pending = IncomingBay.objects.filter(validation_status='PENDING')

for bay in pending:
    print(f"{bay.bay_id}: {bay.detection_note}")
    print(f"  Suggested: {bay.connected_to_substation}")
    print(f"  Confidence: {bay.detection_confidence}")
```

### Example 4: Check for Topology Changes

```python
# Periodic check for changes
changes = NetworkTopologyService.check_topology_changes()

for change in changes:
    print(f"Bay {change['bay_id']}: {change['old']} → {change['new']}")
```

## Detection Rules

### Pattern 1: Standard Connection (Confidence: 0.95)

**Rule**: Extract mnemonic from bay name, find exact match

```python
# SRDN1 → SRDN → Find substation with mnemonic='SRDN'
# GPTH2 → GPTH → Find substation with mnemonic='GPTH'
```

**Auto-validate**: Yes (if exactly 1 match found)

### Pattern 2: Autotransformer (Confidence: 0.99)

**Rule**: Check if bay name starts with known autotransformer patterns

```python
AUTOTRANSFORMER_PATTERNS = ['SGT', 'XGT', 'YGT', 'AGT']
# SGT1, SGT2, SGT3 → Autotransformer (internal connection)
```

**Auto-validate**: Yes

### Pattern 3: Tee-Off (Confidence: 0.70)

**Rule**: Split on '/', extract mnemonic from each part

```python
# NRWG/HKCK → ['NRWG', 'HKCK'] → Find both substations
# CBPS2/PMRN → ['CBPS', 'PMRN'] → Find both substations
```

**Auto-validate**: No (always requires user confirmation)

### Pattern 4: Exclusions (Confidence: 0.0)

**Rule**: Equipment names that are not connections

```python
EXCLUDED_NAMES = ['Capbank', 'Reactor', 'SVC', 'STATCOM', 'Shunt']
```

**Auto-validate**: No (marked as UNKNOWN)

## API Endpoints

### Get Pending Validations
```http
GET /api/v1/topology/pending-validations/
```

### Validate Connection
```http
POST /api/v1/topology/validate/
{
    "bay_id": "ABBA132_NRWG/HKCK",
    "action": "APPROVE",
    "connection_type": "TEE_OFF",
    "connected_to": "NRWG132",
    "tee_offs": ["NRWG132", "HKCK132"]
}
```

### Run Auto-Detection
```http
POST /api/v1/topology/auto-detect/
{
    "confidence_threshold": 0.95,
    "auto_validate": true
}
```

### Check for Changes
```http
POST /api/v1/topology/check-changes/
```

## Admin Interface

### List View Filters
- Validation status (PENDING, VALIDATED, AUTO_VALIDATED, REJECTED)
- Connection type (STANDARD, TEE_OFF, AUTOTRANSFORMER, UNKNOWN)
- Topology changed flag
- Auto-detected flag

### Bulk Actions
- Run auto-detection
- Mark as validated
- Check for changes

## Common Workflows

### Workflow 1: Initial Topology Setup

1. Run auto-detection on all bays
2. Review high-confidence auto-validations
3. Validate pending medium-confidence detections
4. Manually input low-confidence connections
5. Generate topology coverage report

### Workflow 2: Periodic Validation

1. Run change detection check
2. Review flagged changes
3. Validate or reject changes
4. Update topology as needed
5. Clear topology_changed flags

### Workflow 3: New Substation Addition

1. Add substation to database
2. Add incoming bays
3. Run auto-detection on new bays
4. Validate detected connections
5. Verify network graph completeness

## Troubleshooting

### Issue: Low Detection Accuracy

**Symptoms**: Many bays marked as UNKNOWN or low confidence

**Solutions**:
1. Check for bay name typos or inconsistencies
2. Verify substation mnemonics are correct
3. Add new patterns to autotransformer list
4. Add equipment names to exclusion list
5. Review and refine detection algorithms

### Issue: False Positive Connections

**Symptoms**: Auto-validated connections are incorrect

**Solutions**:
1. Lower confidence threshold for auto-validation
2. Add problematic patterns to manual review list
3. Check for duplicate mnemonics in database
4. Verify bay naming conventions

### Issue: Pending Validation Backlog

**Symptoms**: Too many bays awaiting validation

**Solutions**:
1. Organize validation campaign
2. Use bulk approval for high-confidence batches
3. Simplify validation UI
4. Prioritize critical substations
5. Consider temporary manual bypass

## Best Practices

1. **Always validate tee-offs**: Never auto-validate tee-off connections
2. **Review auto-validations**: Periodically audit auto-validated connections
3. **Keep exclusion list updated**: Add new equipment types as discovered
4. **Run periodic checks**: Schedule weekly/monthly change detection
5. **Document edge cases**: Track unusual patterns for algorithm improvement
6. **Maintain audit trail**: Keep records of all manual validations
7. **Prioritize critical substations**: Validate load shedding substations first

## Integration with Load Shedding

The network topology system is the foundation for load shedding analysis:

1. **Cascading Impact**: Identify substations affected by bay trips
2. **Load Loss Calculation**: Calculate total MW loss including cascading effects
3. **Validation Requirements**: Block load shedding if topology incomplete
4. **Confidence Indicators**: Show topology confidence in load shedding UI

## Performance Targets

- **Detection Speed**: <1 second per bay
- **Bulk Detection**: <5 minutes for entire database
- **API Response**: <500ms
- **Detection Accuracy**: ≥85%
- **False Positive Rate**: 0% for auto-validated connections

## Monitoring Metrics

Track these metrics to ensure system health:

- Detection accuracy rate
- User validation completion rate
- Average confidence score
- Number of topology changes per week
- API response times
- User validation time per bay

## Future Enhancements

- Machine learning for pattern recognition
- Graph visualization of network topology
- Automated redundancy detection
- Island detection algorithms
- Shortest path analysis
- Network flow calculations

---

**Version**: 1.0  
**Last Updated**: 2026-02-08  
**Maintainer**: Power System Team
