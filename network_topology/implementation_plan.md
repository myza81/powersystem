# Network Topology Implementation Plan

**Version**: 1.0  
**Last Updated**: 2026-02-08  
**Status**: Planning Complete, Ready for Implementation

---

## Overview

Build an intelligent network topology detection system that automatically identifies substation connections from incoming bay names, with strict validation rules and mandatory user oversight for ambiguous cases.

---

## Design Principles

1. **Conservative Detection**: Only auto-apply connections with very high confidence (>0.90)
2. **Mandatory User Validation**: All ambiguous cases require explicit user approval
3. **Audit Trail**: Track all changes with timestamps and user attribution
4. **Change Detection**: Alert users when topology changes are detected
5. **Fail-Safe**: Default to "unknown" rather than incorrect connections

---

## Enhanced IncomingBay Model

### New Fields

```python
# Connection tracking
connection_type = CharField(choices=['STANDARD', 'TEE_OFF', 'AUTOTRANSFORMER', 'UNKNOWN'])
connected_to_substation = ForeignKey(Substation, null=True)
tee_off_connections = ManyToManyField(Substation)

# Validation state
validation_status = CharField(choices=['PENDING', 'VALIDATED', 'AUTO_VALIDATED', 'REJECTED'])
auto_detected = BooleanField(default=False)
detection_confidence = FloatField(null=True)
detection_note = TextField(null=True)

# User validation
validated_by = ForeignKey(User, null=True)
validated_at = DateTimeField(null=True)

# Change tracking
topology_last_checked = DateTimeField(null=True)
topology_changed = BooleanField(default=False)
```

### Key Behaviors

- **Auto-detect on save**: When bay_name changes, flag for re-validation
- **Change tracking**: Compare new detection with existing connection
- **Validation workflow**: PENDING → User Review → VALIDATED/REJECTED

---

## Detection Rules

### Confidence Thresholds

| Confidence | Action | Examples |
|------------|--------|----------|
| ≥0.95 | Auto-validate | Exact mnemonic match, autotransformers |
| 0.70-0.94 | Suggest, require approval | Tee-offs, single match from multi-part |
| <0.70 | Reject, manual input | No match, multiple ambiguous matches |

### Pattern Detection

**1. Standard Connections (Confidence: 0.95)**
```
SRDN1 → SRDN132 (exact mnemonic match)
GPTH2 → GPTH132 (exact mnemonic match)
```

**2. Autotransformers (Confidence: 0.99)**
```
SGT1, SGT2, SGT3 → Same substation (internal)
XGT1, YGT1 → Same substation (internal)
```

**3. Tee-Off Connections (Confidence: 0.70)**
```
NRWG/HKCK → NRWG132 + HKCK132 (requires validation)
CBPS2/PMRN → CBPS132 + PMRN132 (requires validation)
```

**4. Exclusions (Confidence: 0.0)**
```
Capbank, Reactor, SVC, STATCOM → Not connections
```

---

## NetworkTopologyService

### Core Methods

```python
class NetworkTopologyService:
    @classmethod
    def detect_connections(cls, incoming_bay):
        """Main detection method - returns detection result with confidence"""
        
    @classmethod
    def detect_standard(cls, bay_name, incoming_bay):
        """Detect standard connection from mnemonic"""
        
    @classmethod
    def detect_tee_off(cls, bay_name, incoming_bay):
        """Detect tee-off connections (always requires validation)"""
        
    @classmethod
    def is_autotransformer(cls, bay_name):
        """Check if bay is autotransformer"""
        
    @classmethod
    def auto_detect_all(cls, confidence_threshold=0.95):
        """Bulk detection on all bays"""
        
    @classmethod
    def check_topology_changes(cls):
        """Periodic check for topology changes"""
```

---

## User Validation Workflow

### API Endpoints

```python
# Get pending validations
GET /api/v1/topology/pending-validations/

# Validate connection
POST /api/v1/topology/validate/
{
    'bay_id': 'ABBA132_NRWG/HKCK',
    'action': 'APPROVE' | 'REJECT' | 'MODIFY',
    'connection_type': 'TEE_OFF',
    'connected_to': 'NRWG132',
    'tee_offs': ['NRWG132', 'HKCK132']
}

# Bulk auto-detect
POST /api/v1/topology/auto-detect/

# Check for changes
POST /api/v1/topology/check-changes/
```

### Admin Interface

- List view with validation status badges
- Filter by validation status, connection type
- Bulk actions: run detection, mark validated, check changes
- Inline editing for quick corrections

---

## Implementation Phases

### Phase 1: Model Enhancement (4 hours)
- Add new fields to IncomingBay model
- Create migration
- Update admin interface
- Add indexes for performance

### Phase 2: Detection Service (6 hours)
- Implement NetworkTopologyService
- Add pattern matching algorithms
- Create confidence scoring
- Unit tests for detection logic

### Phase 3: User Validation (4 hours)
- Create API endpoints
- Build admin actions
- Add validation workflow
- Change detection system

### Phase 4: Testing & Validation (4 hours)
- Test with real data
- Validate edge cases
- Performance testing
- User acceptance testing

**Total Estimated Effort**: 18 hours (~2-3 days)

---

## Success Criteria

✅ All migrations apply without errors  
✅ Detection service achieves 85-90% accuracy  
✅ User validation workflow is intuitive  
✅ Change detection alerts work correctly  
✅ Audit trail captures all changes  
✅ Performance is acceptable (<1s per detection)  

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1: Model Enhancement
3. Test detection algorithms with sample data
4. Iterate based on results
5. Deploy to production with monitoring
