# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

A Django + React platform for managing and analysing the Malaysian power grid (TNB). It handles network topology imports (PSS/E cases), load-shedding scheme design (UFLS/UVLS/EMLS), critical-asset tracking, and geographic visualisation.

---

## Commands

```bash
# Backend (from repo root)
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend && npm install && npm run dev

# Celery (async tasks — optional)
celery -A powersystem worker -l info

# After any model change — always commit the generated file
python manage.py makemigrations
```

API: `http://localhost:8000/api/v1/` · Frontend dev server proxies to the backend.

---

## Project Layout

```
powersystem_core/   Django project (settings.py, urls.py)
api/v1/             REST API — views/, serializers/
core/               Django app — models/, migrations/, fixtures/
  models/
    core_models.py  All operational models (Substation, LoadShedding*, Critical*)
    snapshot_models.py  PSS/E topology models (NetworkSnapshot, TopologyBus, etc.)
services/           Business logic (TopologyService — island detection)
frontend/src/
  App.jsx           Root: auth gate, view routing, top-level state
  api.js            Axios instance with CSRF + session auth
  components/       One component per feature — no global store
```

---

## URL / Router

All API endpoints are registered in `powersystem_core/urls.py` using `DefaultRouter`. Auth endpoints (`/users/me/`, `/users/login/`, `/users/logout/`) are declared separately before the router include. Dev-only export/import endpoints are gated behind `settings.DEBUG`.

---

## Key Data Models (`core/models/core_models.py`)

**Grid master data**
- `Substation` — physical node; `substation_id` = mnemonic + voltage (e.g. `MWTA132`); auto-derived `region` from `grid`.
- `LoadTransformer`, `AutoTransformer`, `IncomingBranch` — equipment at or between substations.
- `LoadSheddingRelay` — relay device at a substation; links to transformers + branches it controls.

**Load shedding hierarchy** (Version → Stage → Bays)
- `LoadSheddingVersion` — scheme draft/active/deactivated. Only one `is_active=True` per `scheme_type` at a time; `publish()` auto-deactivates the old one.
- `LoadSheddingStage` — ordered step within a version; UFLS/UVLS stages require at least one `LoadSheddingSetting`.
- `LoadSheddingTransformerBay` — direct relay-based load assignment per stage; `mw_cache` stores last computed MW.
- `LoadSheddingPocketBay` — topology-defined isolated island per stage; `topology_cache` holds `isolated_substations`, `mw`, `substation_mw`; `manual_substations` + `manual_override` flag for operator overrides.
- `LoadSheddingAlertConfig` — per-scheme-type rule enforcement settings (Rule 1 / Rule 2 enforcement mode, protected stages).

**Critical infrastructure**
- `CriticalCategory` / `CriticalSource` / `CriticalAsset` — links critical loads to substations and transformers.

**Snapshot / topology** (`snapshot_models.py`)
- `NetworkSnapshot` — imported PSS/E `.raw` case.
- `TopologyBus`, `TopologyBranch`, `TopologyTransformer` — parsed network elements.
- `SnapshotBusState` — energisation state per bus per snapshot.

---

## API Patterns

- Standard CRUD: `ModelViewSet` + `DefaultRouter`. Read-only is public (`AllowAny`); writes require `IsStaffOrSuperuser`.
- `SubstationViewSet.get_serializer_context()` injects `scheme_types_map` and `stages_map` on list actions — these are computed from `LoadSheddingTransformerBay` and `LoadSheddingPocketBay` rows, not from the version model directly.
- `SubstationViewSet.perform_create()` auto-generates `substation_id` = mnemonic + voltage string.

**Key custom actions on `LoadSheddingVersionViewSet`:**
- `POST /{id}/bulk_save_stages/` — the designer's primary save; creates/updates all stages, bays, and boundaries in one transaction; also recomputes MW cache. Enforces Rule 3 server-side.
- `GET /{id}/active_protected_bays/` — returns substations locked by the active published version (for cross-scheme Rule 1 checks).
- `GET /{id}/compliance_report/` — runs Rule 1, Rule 2, and Rule 3 checks against a version; used by the Reviewer.
- `GET /{id}/pre_publish_diff/` — returns the active version ID so the frontend can build a diff before publishing.

**Key custom actions on `LoadSheddingPocketBayViewSet`:**
- `PATCH /{id}/manual-override/` — saves `manual_substations` list for a pocket bay.
- `GET /substation-mw/` — returns MW per substation (for the Manual Island Override picker).
- `POST /recompute/` — triggers topology recompute for listed pocket bay IDs.

---

## Frontend Architecture

**No global state manager.** All state lives in component `useState`/`useMemo`. Draft workspace state is persisted to `sessionStorage` under the key `ls_draft_state` (debounced).

**View routing** is handled in `App.jsx` via a `view` string synced to the URL `?view=` param. `MainLayout` + `Sidebar` wrap all views. Access control: staff views include `load-shedding-designer`, `snapshots`, `create`/`edit`; admin-only: `dev-tools`.

**`LoadSheddingDesigner.jsx`** (~3900 lines) is the most complex component:
- Manages the full designer workspace: version metadata, stages array, transformer bays, pocket bays, pocket preview.
- `stages` state shape: `[{ id, stage_number, label, target_mw, transformer_bays, computed_pockets, pocket_branches, setting_ids }]`
- `computed_pockets` shape: `{ id, branches, branchGroups, pocket_substations, manual_substations, manual_override, total_p_mw, substation_mw }`
- `PublishReasonModal` is a `React.memo` component defined at the top of the file to prevent re-renders from reason-field keystrokes propagating to the full designer.
- `reasonInputsRef` holds DOM refs to reason `<input>` nodes so the publish handler reads values without controlled-state re-renders.
- `skipDirtyRef` prevents the `isDirty` flag from firing on initial hydration.

**`LoadSheddingSchemeReviewer.jsx`** — read-only compliance viewer. Fetches `compliance_report` from the API and displays Rule 1 / Rule 2 / Rule 3 violations.

---

## Design Rules (Load Shedding)

Three rules are enforced at design time in the designer and validated server-side in `bulk_save_stages`:

| Rule | Description | Enforcement |
|------|-------------|-------------|
| Rule 1 — No Cross-Scheme Overlap | A substation in UFLS protected stages cannot appear in UVLS/EMLS and vice versa. | Configurable per scheme (`rule1_enforcement`: `warn`/`block`) |
| Rule 2 — Critical Substation Protection | Critical substations must not be in restricted stages for their scheme type. | Configurable per scheme (`rule2_enforcement`: `warn`/`block`) |
| Rule 3 — No Direct/Pocket Overlap | A substation cannot be both a direct `TransformerBay` and inside a `PocketBay` (topology-derived or manual) in the same version. | Always hard block, version-wide |

Rule 3 is enforced at three trigger points in the frontend: `addTransformerToStage`, `handleLockPocket`, and `ManualIslandModal.handleSave`.

---

## Conventions

- **Migrations**: every model edit ships with `makemigrations`. Always commit the generated file.
- **API versioning**: all endpoints live under `api/v1/`. Add new ViewSets to `powersystem_core/urls.py`.
- **Frontend API calls**: use the `api` Axios instance from `frontend/src/api.js` (handles CSRF automatically).
- **Media files**: uploads go to `media/`. Never commit.
- **Substation ID**: generated as `{mnemonic}{voltage}` (e.g. `JNKA132`). The `mnemonic` is a 4-letter site code.
- **PSS/E import is the source of truth**: network topology comes from parsed `.raw` files via `SnapshotManager`; never hard-code grid topology.
