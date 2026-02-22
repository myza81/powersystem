# Critical Substation & Bay Tagging Schema

Purpose: maintain a live registry of critical substations and critical bays (LoadTransformer / AutoTransformer / IncomingBranch) serving sensitive loads (hospital, rail, airport, water, etc.). Tags must be flexible, auditable, and easy to update.

## Design goals
- Tag at **Substation** or **Bay** (LoadTransformer/AutoTransformer/IncomingBranch via `bay_id`)
- Support multiple critical categories per asset
- Keep history (who/when/why) without deleting old tags
- Allow temporary and time‑bounded designations
- Avoid duplication; use stable identifiers

## Core tables

### 1) Critical Category
Table: `critical_category`
- `id` (uuid, pk)
- `code` (string, unique)  // HOSPITAL, RAIL, AIRPORT, WATER, GOV, DEFENSE
- `name` (string)
- `description` (text, optional)
- `severity_rank` (int, optional; 1 = highest)
- `is_active` (bool, default true)

### 2) Critical Asset Tag (live + history)
Table: `critical_asset_tag`
- `id` (uuid, pk)
- `asset_type` (enum: `substation`, `load_transformer`, `auto_transformer`, `incoming_branch`)
- `substation` (fk -> `Substation`, nullable)
- `load_transformer` (fk -> `LoadTransformer`, nullable)
- `auto_transformer` (fk -> `AutoTransformer`, nullable)
- `incoming_branch` (fk -> `IncomingBranch`, nullable)
- `bay_id` (string, optional) // stored for human search; derived from FK
- `category` (fk -> `critical_category`)
- `is_critical` (bool, default true)
- `effective_from` (date)
- `effective_to` (date, null)
- `status` (enum: `pending`, `approved`, `rejected`)
- `confidence` (enum: `low`, `medium`, `high`)
- `notes` (text, optional)
- `source` (fk -> `critical_source`, nullable)
- `created_by`, `updated_by` (fk -> user)
- `created_at`, `updated_at`

Constraints:
- Exactly one FK among (`substation`, `load_transformer`, `auto_transformer`, `incoming_branch`) must be set
- Unique current tag per asset + category where `effective_to is null`

### 3) Evidence / Source (optional but recommended)
Table: `critical_source`
- `id` (uuid, pk)
- `evidence_origin` (fk -> `critical_origin`) // dynamic list (e.g., Suruhanjaya Tenaga, TNB DN, Customer)
- `reference` (string) // doc ID, ticket, memo
- `url` (string, nullable)
- `issued_date` (date, nullable)

### 4) Evidence Origin (dynamic)
Table: `critical_origin`
- `id` (uuid, pk)
- `name` (string, unique)  // Suruhanjaya Tenaga, TNB DN, Customer
- `description` (text, optional) 
- `is_active` (bool, default true)


## How it works
- For a **substation‑level** designation: insert one `critical_asset_tag` with `substation` set.
- For **bay‑level** designation (e.g., `ABBA132_T1`): insert one `critical_asset_tag` with `load_transformer` set.
- Multiple categories can coexist (e.g., Hospital + Rail).
- If a designation is removed, set `effective_to` and keep the row (audit trail).

## Query patterns
- Current critical assets: `critical_asset_tag` where `effective_to is null` and `status = approved`.
- All critical bays under a substation: join `LoadTransformer`/`AutoTransformer`/`IncomingBranch` by substation.
- History for a bay: all tags for that bay ordered by `effective_from`.

## Best‑practice rules
- Prefer **FK linkage** to actual models; `bay_id` is for search/display only.
- Use `effective_from`/`effective_to` instead of deleting rows.
- Enforce **non‑overlap** for the same asset+category (unique current tag).
- Keep category list managed by admins (not free‑text).

## Example tags
- Substation critical:
  - `asset_type=substation`, `substation=ABBA132`, `category=HOSPITAL`
- Bay critical:
  - `asset_type=load_transformer`, `load_transformer=ABBA132_T1`, `category=HOSPITAL`
  - `asset_type=incoming_branch`, `incoming_branch=ABBA132_IOIM132_1`, `category=RAIL`
