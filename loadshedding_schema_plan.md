# Load Shedding Schema Plan

*Status: Draft v2 — Schema corrections applied. Pending final approval before migration.*

---

## Context & Design Decisions

- **Versioning**: Deferred to a later phase. Schema is designed to accommodate a `SchemeVersion` FK later without breaking changes (add a nullable FK and migrate).
- **Multiple pick-up elements**: Each stage can have 1..N pick-up elements (`LoadSheddingPickup`). For example, Stage 9 has two: `{48.3 Hz, 0s delay}` AND `{49.3 Hz, 60s delay}`.
- **EMLS**: No threshold/pickup settings. Operator-triggered only. Uses the same bay assignment structure (Transformer/Spur/Pocket) but `LoadSheddingPickup` rows are not created.
- **Pocket boundary**: Requires a `LoadSheddingRelay` at **both** boundary substations. The system must validate pocket integrity against the active topology and alert the user if the pocket is no longer topologically sound.

---

## Corrected Table Designs

### 0. `LoadSheddingRelay` *(existing — unchanged)*

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `substation` | FK → Substation | |
| `load_transformers` | M2M → LoadTransformer | Bays wired to this relay panel |
| `incoming_branches` | M2M → IncomingBranch | Branches wired to this relay panel |
| `auto_transformers` | M2M → AutoTransformer | Auto-TX bays wired to this relay panel |
| `is_active` | BooleanField | Default True |
| `notes` | TextField, optional | |

---

### 1. `LoadSheddingScheme` — Scheme type header

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `scheme_type` | CharField(10) | `UFLS`, `UVLS`, or `EMLS` |
| `name` | CharField(100) | e.g. `"UFLS"` (type-level label, not version-specific) |
| `description` | TextField, optional | |
| `created_at` | DateTimeField | Auto |

> **Design note**: `scheme_type` lives here and flows down. This model is a stable anchor — it never changes once created. All versioning, status, and editing happens in `LoadSheddingVersion`.

---

### 1b. `LoadSheddingVersion` — Versioned snapshot of a scheme

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `scheme` | FK → LoadSheddingScheme | Parent scheme (UFLS / UVLS / EMLS) |
| `version_label` | CharField(50) | e.g. `"2024-v1"`, `"2025-draft"` |
| `status` | CharField(20) | `draft` or `published` |
| `is_active` | BooleanField | Whether this is the currently enforced version |
| `published_at` | DateTimeField, optional | Timestamp when status changed to `published` |
| `published_by` | FK → User, optional | Who published it |
| `created_at` | DateTimeField | Auto |
| `updated_at` | DateTimeField | Auto |
| `notes` | TextField, optional | e.g. change notes between versions |

> **Access control (enforced at the API view layer, not DB level):**
> - `status = 'draft'` → Any authenticated user can create, edit, or delete stages, pickups, and bays under this version.
> - `status = 'published'` → Read-only for all users. Only admin (`is_staff = True`) can make changes.
>
> **Workflow:** Team works in `draft` → admin reviews → admin publishes → system marks `is_active = True` on this version and `is_active = False` on the previous one.
>
> **Coexistence example:**
> - `UFLS v1.0` → `published`, `is_active = True` — currently enforced, locked
> - `UFLS v2.0` → `draft`, `is_active = False` — team editing 2025 changes freely

---

### 2. `LoadSheddingStage` — Numbered shedding block

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `version` | FK → LoadSheddingVersion | Parent version (not direct to Scheme) |
| `stage_number` | IntegerField | 1, 2, 3 … n |
| `label` | CharField(100), optional | Human label e.g. `"Stage 9 — Sustained Underfrequency"` |
| `total_mw_estimate` | FloatField, read-only | Cached sum of all bay MW. Re-computed on save. |

> **Uniqueness constraint**: `unique_together = ('scheme', 'stage_number')`

---

### 3. `LoadSheddingPickup` — Threshold/delay element per stage

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | Parent stage |
| `order` | IntegerField | For ordering multiple elements (1, 2…) |
| `threshold` | FloatField | Hz for UFLS; p.u. for UVLS |
| `time_delay` | FloatField | Seconds |
| `notes` | CharField(200), optional | e.g. `"Sustained underfrequency pickup"` |

> **Applies to**: `UFLS` and `UVLS` only. EMLS stages will have **zero** `LoadSheddingPickup` rows.
> **Example (Stage 9)**: Two rows — `{threshold: 48.3, delay: 0, order: 1}` and `{threshold: 49.3, delay: 60, order: 2}`.
> **Uniqueness constraint**: `unique_together = ('stage', 'order')`

---

### 4. `LoadSheddingTransformerBay` — Local load at a substation's transformers

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | |
| `relay` | FK → LoadSheddingRelay | The relay panel that will trip these transformers |
| `transformers` | M2M → LoadTransformer | Which specific transformers to trip |
| `cached_total_mw` | FloatField, optional | Last computed load MW (from active snapshot) |
| `cached_at` | DateTimeField, optional | When the MW cache was last computed |
| `notes` | CharField(200), optional | |

> **MW Computation**: At save, call `TopologyService.get_load_transformers_by_substation()` for `relay.substation`, then filter the results by the selected `load_id`s (T1, T2…) in `transformers`. Sum their `p_mw`.
> No topology traversal needed — load is local to substation.

---

### 5. `LoadSheddingSpurBay` — Spur radial branch isolation

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | |
| `relay` | FK → LoadSheddingRelay | Relay at the spur source substation that will open the lines |
| `branches` | M2M → IncomingBranch | The spur line(s) to open (e.g. ASMB132 ckt 1+2) |
| `cached_isolated_substations` | JSONField, optional | List of substation_ids isolated beyond the spur |
| `cached_total_mw` | FloatField, optional | Last computed load MW |
| `cached_at` | DateTimeField, optional | |
| `notes` | CharField(200), optional | |

> **MW Computation**: At save, use `TopologyService.compute_island(cuts)` where cuts are built from the `branches` M2M (format: `from_sub → to_sub, ckt_ids`). The resulting isolated substations are passed to `compute_load_totals()`. Cache both the substation list and total MW.

---

### 6. `LoadSheddingPocketBay` — Network pocket isolation

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | |
| `boundary_relays` | M2M → LoadSheddingRelay | Relays at **all** boundary substations that must trip (1…N substations depending on meshed topology) |
| `boundary_branches` | M2M → IncomingBranch | **All** boundary lines to open to seal the pocket (one per boundary relay-circuit pair) |
| `cached_isolated_substations` | JSONField, optional | Substations enclosed within the pocket |
| `cached_total_mw` | FloatField, optional | Last computed load MW |
| `cached_at` | DateTimeField, optional | |
| `topology_valid` | BooleanField | `True` = all pocket boundaries still exist and form a closed pocket in active topology |
| `topology_alert` | TextField, optional | Human-readable reason if `topology_valid = False` |
| `topology_validated_at` | DateTimeField, optional | Timestamp of last topology check |
| `notes` | CharField(200), optional | |

> **Meshed network support**: A pocket can require **any number** of boundary substations. For example, isolating a group of 3 inner substations in a mesh may require opening boundary lines at 4 or more external substations simultaneously. The `boundary_relays` and `boundary_branches` M2M fields have no N limit.
>
> **MW Computation**: At save, use `TopologyService.compute_island(cuts)` where cuts include **all** boundary branches (all sides of the pocket). The disconnected component is the pocket. Pass to `compute_load_totals()`.
>
> **Pocket Validity Check** (run on every save or on active topology snapshot change):
> 1. Load the active `NetworkSnapshot`.
> 2. For **each** `IncomingBranch` in `boundary_branches`, verify it still exists in `TopologyBranch` with the expected substation pair and `ckt_id`.
> 3. Run `compute_island(all_cuts)`. If the result is an **empty set** (no substations isolated), the pocket boundaries no longer form a closed cut in the current topology.
> 4. If any check fails, set `topology_valid = False` and populate `topology_alert` with a specific message, e.g.:
>    - `"Pocket invalid: TMPI132–OLPT275 Ckt 1 no longer present in active topology."`
>    - `"Pocket invalid: Boundary cuts are insufficient — no substations isolated. Network topology has changed (verify boundary branch at FLKR132)."`

---

## Full Relationship Chain

```
LoadSheddingScheme (UFLS / UVLS / EMLS)
  └── LoadSheddingVersion (2024-v1: published | 2025-v1: draft)
           └── LoadSheddingStage (Stage 1, 2, ... N)
                    ├── LoadSheddingPickup (threshold/delay pairs — UFLS/UVLS only)
                    ├── LoadSheddingTransformerBay
                    │        ├── relay → LoadSheddingRelay → substation + wired bays
                    │        └── transformers (M2M) → LoadTransformer
                    ├── LoadSheddingSpurBay
                    │        ├── relay → LoadSheddingRelay
                    │        └── branches (M2M) → IncomingBranch
                    └── LoadSheddingPocketBay
                             ├── boundary_relays (M2M) → LoadSheddingRelay (N substations)
                             └── boundary_branches (M2M) → IncomingBranch (all boundary lines)
```

---

## Topology Engine Integration

| Bay Type | Method | Output |
|---|---|---|
| `TransformerBay` | `get_load_transformers_by_substation(relay.substation)` → filter by selected transformer `load_id` | Direct MW sum — no traversal |
| `SpurBay` | `compute_island(cuts_from_branches)` → `compute_load_totals(isolated_substations)` | Island MW sum |
| `PocketBay` | `compute_island(all_boundary_cuts)` → `compute_load_totals(pocketed_substations)` | Pocket MW sum + validity check |

> **Cut format for `compute_island()`**:
> ```python
> cuts = [
>     {
>         "from_substation_id": branch.substation.substation_id,
>         "to_substation_id": branch.to_substation.substation_id,
>         "circuit_ids": [branch.ckt_id],
>         "link_type": "branch",
>         "isolation_scope": "between",
>     }
>     for branch in bay.boundary_branches.all()
> ]
> ```

---

## Corrected Sample Data

```
LoadSheddingScheme: UFLS 2024 (is_active=True)

  Stage 9:
    Pickup 1: threshold=48.3 Hz, delay=0s   (arrest steep drop)
    Pickup 2: threshold=49.3 Hz, delay=60s  (sustained stall)

    TransformerBay:
      relay   → LoadSheddingRelay @ BRGS132
      shed    → T1, T2 (11kV transformers)
      cached_total_mw = 18.4 MW

    SpurBay:
      relay   → LoadSheddingRelay @ ASMB132
      branches → ASMB132→MGST132 Ckt 1, ASMB132→MGST132 Ckt 2
      cached_isolated_substations = ["MGST132"]
      cached_total_mw = 12.1 MW

    PocketBay:
      boundary_relays   → [relay@TMPI132, relay@OLPT275]
      boundary_branches → [TMPI132→FLKR132 Ckt 1, OLPT275→FLKR132 Ckt 1]
      cached_isolated_substations = ["FLKR132", "PNJG132"]
      cached_total_mw = 34.7 MW
      topology_valid = True

  Stage 9 Total Estimate = 18.4 + 12.1 + 34.7 = 65.2 MW
```

---

## What's Deliberately Excluded (Now)

| Item | Reason |
|---|---|
| `SchemeVersion` | Deferred. Add a nullable `version` FK to `LoadSheddingScheme` in a future phase without breaking changes. |
| `ShedGroupAssignment` (from original plan) | Superseded by the three bay models, which are more explicit and type-safe. |
| `ProtectionRelay` / `RelayTripAssignment` | The existing `LoadSheddingRelay` (with M2M to bays) fulfils this role more cleanly. The string-based `circuit_id` pattern from the original plan is not needed since we FK directly to `LoadTransformer` / `IncomingBranch`. |
| MW validation rules | Live in `services/shedding_rules.py` — no DB migration required. |

---

## Proposed Migration Steps

| # | Action |
|---|---|
| 1 | Create `LoadSheddingScheme` model + migration |
| 2 | Create `LoadSheddingStage` model + migration |
| 3 | Create `LoadSheddingPickup` model + migration |
| 4 | Create `LoadSheddingTransformerBay`, `LoadSheddingSpurBay`, `LoadSheddingPocketBay` models + migration |
| 5 | Add `topology_service` integration in each bay model's `save()` method |
| 6 | Write pocket validity checker in `services/shedding_rules.py` |
| 7 | Create serializers + viewsets + register URLs |
| 8 | Build frontend UI |
