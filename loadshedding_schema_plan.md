# Load Shedding Schema Plan

*Status: Pending review before migration proceeds.*

---

## Table Designs

### 1. `ProtectionRelay` — Panel header

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `relay_type` | CharField | `UFLS` or `UVLS` |
| `relay_panel_location` | CharField(30), optional | e.g. `132kV Coupler`, `Bay 3 Panel` |
| `substation` | FK → Substation | Dropdown by `substation_id` |
| `notes` | TextField, optional | Single notes field for the whole relay panel |
| `created_at` | DateTimeField | Auto |
| `updated_at` | DateTimeField | Auto |

---

### 2. `RelayTripAssignment` — Child rows (one per circuit tripped)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `relay` | FK → ProtectionRelay | Parent relay panel |
| `assignment_type` | CharField | `branch` or `load_transformer` |
| `target_substation_id` | CharField(20), optional | Generic for both types. `branch` → remote-end substation (e.g. `MGST132`). `load_transformer` → null (transformer is at relay's substation). |
| `circuit_id` | CharField(10) | e.g. `1`, `2` for branches; `T1`, `T2` for transformers |

**Design notes:**
- No `from_substation_id` — derived from `relay.substation`.
- No `notes` — lives on `ProtectionRelay` only.
- Uniqueness constraint: `(relay, assignment_type, target_substation_id, circuit_id)`.

#### Topology Linkage Strategy

`NetworkBranch` and `NetworkTransformer` are **snapshot-specific** — every import creates new rows. Relay assignments must survive across snapshots, so we **cannot hard-FK** to these models.

Instead:
- `target_substation_id` + `circuit_id` store **stable string identifiers**
- The **admin/UI dropdown** is populated at runtime from the latest active snapshot via topology API
- **Validation** handled by external helper functions (see Business Rules below)

---

### 3. `ShedGroupAssignment` — Link table (scheme stage ↔ relay circuit)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `group` | FK → ShedGroupSetting | Which stage this circuit belongs to |
| `relay_trip` | FK → RelayTripAssignment | Which relay trips this circuit |
| `note` | TextField, optional | Optional context note |

**Removed fields**: `assignment_type`, `from_substation_id`, `to_substation_id`, `circuit_id`, `substation` — all derived through `relay_trip → RelayTripAssignment → ProtectionRelay`.

---

## Business Rules (External Helper Functions)

These rules are **not enforced at DB level** — they live in `services/shedding_rules.py` 
so they remain flexible and expandable as new requirements emerge.

### Current Rules

| Rule | Description |
|---|---|
| `validate_unique_stage_per_scheme_type` | A `relay_trip` must appear in only **one stage** within a scheme type (UFLS, UVLS, or Manual). The same circuit CAN appear across all three scheme types. |
| `validate_circuit_in_topology` | `(target_substation_id, circuit_id)` must exist in the current active snapshot's branches or transformers. |

### Expanding Rules (future additions go here)

The helper function architecture allows adding rules without DB migrations, e.g.:
- Maximum MW shed per stage
- Minimum time delay between consecutive stages
- Relay scheme type must match parent scheme type (UFLS relay only in UFLS scheme)
- No duplicate relay panels per substation per scheme version
- etc.

---

## Full Relationship Chain

```
Substation
  └── ProtectionRelay
           └── RelayTripAssignment  ←──────────────────┐
                                                        │
LoadSheddingScheme (UFLS/UVLS/MANUAL)                  │
  └── SchemeVersion (v1.0, v2.0...)                    │
           └── ShedGroupSetting (Stage 1, Stage 2...)   │
                    └── ShedGroupAssignment ────────────┘
```

---

## Example Data

```
ProtectionRelay:
  substation           = BRGS132
  relay_type           = UFLS
  relay_panel_location = 132kV Coupler Bay 3

  RelayTripAssignment A:
    assignment_type      = branch
    target_substation_id = MGST132
    circuit_id           = 1

  RelayTripAssignment B:
    assignment_type      = load_transformer
    target_substation_id = null
    circuit_id           = T1

UFLS 2024 v1.0 → Stage 1:
  ShedGroupAssignment → RelayTripAssignment A   (BRGS132–MGST132 Cct 1)
  ShedGroupAssignment → RelayTripAssignment B   (BRGS132 T1)

UVLS 2024 v1.0 → Stage 1:
  ShedGroupAssignment → RelayTripAssignment A   (same circuit — ALLOWED across schemes)
```

---

## Migration Steps (to execute after approval)

| # | Action |
|---|---|
| 1 | Rewrite `core/migrations/0029` — drop current merged ProtectionRelay; create new `ProtectionRelay` + `RelayTripAssignment`; update `ShedGroupAssignment` |
| 2 | Update `core/models.py` |
| 3 | Update `core/admin.py` — `RelayTripAssignmentInline` inside `ProtectionRelayAdmin` |
| 4 | Rewrite `api/v1/serializers/shedding.py` |
| 5 | Update `api/v1/views/shedding.py` — restore `RelayTripAssignmentViewSet` |
| 6 | Update `urls.py` — restore `shedding/relay-trips` route |
| 7 | Write `services/shedding_rules.py` with `validate_unique_stage_per_scheme_type()` and `validate_circuit_in_topology()` |
