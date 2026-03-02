# Load Shedding Schema Plan

*Status: Draft v3 — User review corrections applied. Pending final approval before migration.*

---

## Context & Design Decisions

- **Versioning**: Deferred to a later phase. Schema is designed to accommodate a `SchemeVersion` FK later without breaking changes (add a nullable FK and migrate).
- **Multiple setting elements**: Each stage can have 1..N setting elements (`LoadSheddingSetting`). For example, Stage 9 has two: `{48.3 Hz, 0s delay}` AND `{49.3 Hz, 60s delay}`.
- **EMLS**: No threshold/setting parameters. Operator-triggered only. Uses the same bay assignment structure (Transformer/Spur/Pocket) but `LoadSheddingSetting` rows are not created.
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

### 1. `LoadSheddingVersion` — Versioned snapshot of a scheme

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `scheme_type` | CharField(10) | `UFLS`, `UVLS`, or `EMLS` (replaces the old `Scheme` model) |
| `version_label` | CharField(50) | e.g. `"2024-v1"`, `"2025-draft"` |
| `status` | CharField(20) | `draft` or `published` |
| `is_active` | BooleanField | Whether this is the currently enforced version |
| `published_at` | DateTimeField, optional | Timestamp when status changed to `published` |
| `published_by` | FK → User, optional | Who published it |
| `created_at` | DateTimeField | Auto |
| `updated_at` | DateTimeField | Auto |
| `notes` | TextField, optional | e.g. change notes between versions |

> **Workflow & State Management (enforced at API/Service layer)**:
> - **Draft state**: `status = 'draft'`. Any authenticated user can edit stages, pickups, and bays. `is_active` must be `False`.
> - **Publishing**: When an admin changes `status` to `'published'`:
>   1. The system auto-stamps `published_at = now()`.
>   2. The system auto-sets `is_active = True` for this version.
>   3. The system finds any existing version where `scheme_type == this.scheme_type` and `is_active == True`, and sets its `is_active = False`.
> - **Post-publish rules**: `status = 'published'` means read-only. No further edits allowed to stages or bays.
>
> **Coexistence example:**
> - `UFLS v1.0` (published May 2024) → `is_active = False`
> - `UFLS v2.0` (published Jan 2025) → `is_active = True` (enforced right now)
> - `UFLS v3.0` (drafting for 2026) → `status = 'draft'`, `is_active = False`

---

### 2. `LoadSheddingStage` — Numbered shedding block

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `version` | FK → LoadSheddingVersion | Parent version (not direct to Scheme) |
| `stage_number` | IntegerField | 1, 2, 3 … n |
| `label` | CharField(100), optional | Human label e.g. `"Stage 9 — Sustained Underfrequency"` |

> **Uniqueness constraint**: `unique_together = ('version', 'stage_number')`
>
> **`total_mw_estimate`** is a **computed API property** only — never stored. The serializer dynamically sums `bay.get_mw(active_snapshot)` across all TransformerBay, SpurBay, and PocketBay children. This ensures the figure is always consistent with whatever snapshot is currently active.

---

### 3. `LoadSheddingSetting` — Threshold/delay element per stage

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | Parent stage |
| `order` | IntegerField | Stable sort key for multiple elements on the same stage (1, 2…) |
| `threshold` | FloatField | Hz for UFLS; p.u. for UVLS |
| `time_delay` | FloatField | Seconds |

> **Applies to**: `UFLS` and `UVLS` only. EMLS stages will have **zero** `LoadSheddingSetting` rows.
> **Example (Stage 9)**: Two rows — `{threshold: 48.3, delay: 0, order: 1}` and `{threshold: 49.3, delay: 60, order: 2}`.
> **`order` is required**: querysets are unordered by default; without it you cannot deterministically render or evaluate two settings on the same stage.
> **Uniqueness constraint**: `unique_together = ('stage', 'order')`

---

### 4. `LoadSheddingTransformerBay` — Local load at a substation's transformers

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | |
| `relay` | FK → LoadSheddingRelay | The relay panel that will trip these transformers |
| `transformers` | M2M → LoadTransformer | Which specific transformers to trip |
| `mw_cache` | JSONField, optional | `{"snapshot_id": "uuid", "mw": 18.4, "computed_at": "..."}` — invalidated when snapshot changes |

> **MW Computation**: At save (or on snapshot change), call `TopologyService.get_load_transformers_by_substation()` for `relay.substation`, filter by selected transformer `load_id`s, sum `p_mw`. Store result in `mw_cache` keyed to `snapshot_id`.
> No topology traversal needed — load is local to substation.
> **`get_mw(snapshot)`**: checks `mw_cache["snapshot_id"] == snapshot.id`; recomputes if stale.

---

### 5. `LoadSheddingSpurBay` — Spur radial branch isolation

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | |
| `relay` | FK → LoadSheddingRelay | Relay at the spur source substation that will open the lines |
| `branches` | M2M → IncomingBranch | The spur line(s) to open (e.g. ASMB132 ckt 1+2) |
| `topology_cache` | JSONField, optional | `{"snapshot_id": "uuid", "isolated_substations": [...], "mw": 12.1, "computed_at": "..."}` |

> **MW Computation**: At save (or on snapshot change), use `TopologyService.compute_island(cuts)` built from `branches` M2M. The resulting isolated substations are passed to `compute_load_totals()`. Store all results in `topology_cache` keyed to `snapshot_id`.
> **`get_mw(snapshot)`**: checks `topology_cache["snapshot_id"] == snapshot.id`; recomputes if stale.

---

### 6. `LoadSheddingPocketBay` — Network pocket isolation

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto |
| `stage` | FK → LoadSheddingStage | |
| `boundary_relays` | M2M → LoadSheddingRelay | Relays at **all** boundary substations that must trip (1…N substations depending on meshed topology) |
| `boundary_branches` | M2M → IncomingBranch | **All** boundary lines to open to seal the pocket (one per boundary relay-circuit pair) |
| `topology_cache` | JSONField, optional | `{"snapshot_id": "uuid", "isolated_substations": [...], "mw": 34.7, "computed_at": "..."}` |
| `topology_valid` | BooleanField | Auto-set: `True` = all boundary lines exist and form a closed pocket in current topology |
| `topology_alert` | TextField, optional | Auto-set: human-readable reason if `topology_valid = False` |

> **Meshed network support**: A pocket can require **any number** of boundary substations. For example, isolating a group of 3 inner substations in a mesh may require opening boundary lines at 4 or more external substations simultaneously. The `boundary_relays` and `boundary_branches` M2M fields have no N limit.
>
> **MW Computation**: At save (or on snapshot change), use `TopologyService.compute_island(cuts)` where cuts include **all** boundary branches. The disconnected component is the pocket. Pass to `compute_load_totals()`. Store all in `topology_cache` keyed to `snapshot_id`.
>
> **`topology_valid` / `topology_alert`** are **system-managed** — never user-filled. They are updated automatically on every save or when the active snapshot changes:
> 1. For **each** `IncomingBranch` in `boundary_branches`, verify it still exists in `TopologyBranch` with the expected substation pair and `ckt_id`.
> 2. Run `compute_island(all_cuts)`. If the result is an **empty set**, the pocket boundaries no longer form a closed cut.
> 3. If any check fails, set `topology_valid = False` and populate `topology_alert`, e.g.:
>    - `"Pocket invalid: TMPI132–OLPT275 Ckt 1 no longer present in active topology."`
>    - `"Pocket invalid: Boundary cuts are insufficient — no substations isolated. Verify boundary branch at FLKR132."`

---

## Full Relationship Chain

```
LoadSheddingVersion (type: UFLS | status: published | label: 2024-v1)
         └── LoadSheddingStage (Stage 1, 2, ... N)
                    ├── LoadSheddingSetting (threshold/delay pairs — UFLS/UVLS only)
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
LoadSheddingVersion: UFLS 2024 (is_active=True, status=published)

  Stage 9:
    Pickup 1: threshold=48.3 Hz, delay=0s   (arrest steep drop)
    Pickup 2: threshold=49.3 Hz, delay=60s  (sustained stall)

    TransformerBay:
      relay        → LoadSheddingRelay @ BRGS132
      shed         → T1, T2 (11kV transformers)
      mw_cache     = {snapshot_id: "abc-123", mw: 18.4, computed_at: "2026-03-01T10:00Z"}

    SpurBay:
      relay          → LoadSheddingRelay @ ASMB132
      branches       → ASMB132→MGST132 Ckt 1, ASMB132→MGST132 Ckt 2
      topology_cache = {snapshot_id: "abc-123", isolated_substations: ["MGST132"], mw: 12.1, computed_at: "2026-03-01T10:00Z"}

    PocketBay:
      boundary_relays   → [relay@TMPI132, relay@OLPT275]
      boundary_branches → [TMPI132→FLKR132 Ckt 1, OLPT275→FLKR132 Ckt 1]
      topology_cache    = {snapshot_id: "abc-123", isolated_substations: ["FLKR132", "PNJG132"], mw: 34.7, computed_at: "2026-03-01T10:00Z"}
      topology_valid    = True
      topology_alert    = None

  Stage 9 Total Estimate (computed) = 18.4 + 12.1 + 34.7 = 65.2 MW  ← API-only, not stored
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
| 1 | Create `LoadSheddingVersion` model + migration (includes scheme_type choices) |
| 2 | Create `LoadSheddingStage` model + migration |
| 3 | Create `LoadSheddingSetting` model + migration |
| 4 | Create `LoadSheddingTransformerBay`, `LoadSheddingSpurBay`, `LoadSheddingPocketBay` models + migration |
| 5 | Add `topology_service` integration in each bay model's `save()` method |
| 6 | Write pocket validity checker in `services/shedding_rules.py` |
| 7 | Create serializers + viewsets + register URLs |
| 8 | Build frontend UI |
