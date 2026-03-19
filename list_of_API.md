# Powersystem API Documentation

All endpoints are prefixed with `/api/v1/`.

---

## Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/snapshots/` | List all snapshots |
| `GET` | `/api/v1/snapshots/{id}/` | Get snapshot detail |
| `POST` | `/api/v1/snapshots/upload/` | Upload raw file (PSS/E, CIF) |
| `POST` | `/api/v1/snapshots/activate/` | Activate a snapshot |

**Upload Payload:**
```json
{
  "file": "<binary>",
  "name": "My Snapshot",
  "description": "Optional description"
}
```

**Activate Payload:**
```json
{
  "snapshot_id": "uuid"
}
```

---

## Topology

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/topology/islands/` | Detect network islands |
| `POST` | `/api/v1/topology/cleanup/` | Delete buses to clean up ghost islands |
| `POST` | `/api/v1/topology/load-shedding-sim/` | Simulate load shedding groups |

**Islands — Query Params:**
- `snapshot_id` (required): UUID of the snapshot

**Response:**
```json
{
  "snapshot": "Name",
  "timestamp": "2026-02-12T15:06:00Z",
  "island_count": 3,
  "islands": [
    {
      "id": 1,
      "bus_count": 45,
      "status": "Energized",
      "total_load_mw": 1200.5,
      "total_load_mvar": 300.2,
      "bus_ids": [1, 5, 9],
      "buses": [...],
      "loads": [...],
      "substations": [...],
      "substation_count": 10,
      "orphan_buses": [...],
      "orphan_count": 2,
      "orphan_load_mw": 0.0
    }
  ]
}
```

**Island Status Types:**
- `Energized` — contains generation, can operate independently
- `De-energized` — has load but no generation (at-risk)
- `Floating` — no load or generation (noise/spare equipment)

**Cleanup — Payload:**
```json
{
  "snapshot_id": "uuid",
  "bus_ids": [1, 2, 3]
}
```

**Load Shedding Simulation — Payload:**
```json
{
  "snapshot_id": "uuid",
  "groups": [
    {
      "name": "Group 1",
      "island_instructions": ["TBRU132 isolate PLGI132 1, PLGI132 2"],
      "load_instructions": ["BLKG132 isolate load T1, T2"],
      "include_autotransformers": true
    }
  ]
}
```

---

## Load Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/load-analytics/aggregate/` | Aggregated load by substation/region/state |
| `GET` | `/api/v1/load-analytics/missing-substations/` | Loads not linked to a substation |

**Query Params:**
- `snapshot_id` (optional): UUID of the snapshot (uses latest if not provided)

**Aggregate Response:**
```json
{
  "snapshot_id": "uuid",
  "snapshot_name": "Feb 2026 Test",
  "timestamp": "2026-02-12T15:06:00Z",
  "total_pload_mw": 28208.17,
  "total_qload_mvar": 5682.47,
  "load_count": 1971,
  "substation_count": 156,
  "regional_breakdown": [...],
  "state_breakdown": [...],
  "ownership_breakdown": [...],
  "unlinked_loads": {...},
  "coverage": {...}
}
```

---

## Substations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/substations/` | List substations |
| `POST` | `/api/v1/substations/` | Create substation |
| `GET` | `/api/v1/substations/{id}/` | Get substation detail |
| `PUT/PATCH` | `/api/v1/substations/{id}/` | Update substation |
| `DELETE` | `/api/v1/substations/{id}/` | Delete substation |
| `GET` | `/api/v1/substations/{id}/view_sld/` | View SLD diagram |
| `POST` | `/api/v1/substations/{id}/upload_sld/` | Upload SLD diagram |

**Query Params (list):**
- `search`: Free-text search

---

## Bay Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/load-transformers/` | List load transformers |
| `GET` | `/api/v1/auto-transformers/` | List auto-transformers |
| `GET` | `/api/v1/incoming-branches/` | List incoming branches |
| `GET` | `/api/v1/load-shedding-relays/` | List load shedding relays |

**Query Params (all):**
- `substation`: Filter by substation ID (e.g., `?substation=SRDN132`)
- `search`: Free-text search on bay_id and substation

All support standard DRF operations: list, create, retrieve, update, partial_update, delete.

---

## Critical Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/critical-categories/` | List critical categories |
| `GET` | `/api/v1/critical-sources/` | List critical sources |
| `GET` | `/api/v1/critical-assets/` | List critical assets |

**Query Params (all):**
- `substation`: Filter by substation ID
- `search`: Free-text search

---

## Load Shedding

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/load-shedding-versions/` | List shedding versions |
| `GET` | `/api/v1/load-shedding-stages/` | List shedding stages |
| `GET` | `/api/v1/load-shedding-settings/` | List shedding settings |
| `GET` | `/api/v1/load-shedding-transformer-bays/` | List transformer bays |
| `GET` | `/api/v1/load-shedding-pocket-bays/` | List pocket bays |
| `GET` | `/api/v1/load-shedding-pocket-boundaries/` | List pocket boundaries |
| `POST` | `/api/v1/load-shedding-relays/{id}/publish/` | Publish relay |
| `POST` | `/api/v1/load-shedding-relays/{id}/clone/` | Clone relay |

All support standard DRF operations: list, create, retrieve, update, partial_update, delete.

---

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users/` | Get current user info |

---

## Authentication

Most endpoints require authentication. Public access is enabled when:
- `DEBUG=True` in `django.conf.settings`, or
- `DJANGO_PUBLIC_API=true` environment variable is set

---
