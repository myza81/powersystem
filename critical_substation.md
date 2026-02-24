# Critical Substation & Bay Tagging Schema

Purpose: maintain a live registry of critical substations and critical bays (LoadTransformer only) serving sensitive loads (hospital, rail, airport, water, etc.). Tags must be flexible, auditable, and easy to update.

## Design goals
- Tag at **Substation** or **Bay** (LoadTransformer only via `bay_id`)
- Support multiple critical categories per asset
- Keep history (who/when/why) without deleting old tags
- Allow temporary and time‑bounded designations
- Avoid duplication; use stable identifiers

## Core tables

### 1) Critical Category
Table: `critical_category`
- `id` (uuid, pk)
- `category_name` (string, unique) // HOSPITAL, RAIL, AIRPORT, WATER, GOV, DEFENSE
- `slug` (string, unique) // auto from category_name (e.g., state_hospital)
- `description` (text, optional)


### 2) Critical Asset Tag (live + history)
Table: `critical_asset_tag`
- `id` (uuid, pk)
- `substation` (fk -> `Substation`, null=false)
- `bay_id` (string, not null) // must be a LoadTransformer bay_id (e.g., ABBA132_T1)
- `category` (fk -> `critical_category`)
- `severity_rank` (int, optional; 1 = highest)
- `source` (fk -> `critical_source`, null=true)
- `short_text` (string, optional) // short note, e.g. "Hospital feeder"
- `is_inforce` (bool, default true)
- `inforce_from` (date, null) // set when tag becomes active
- `inforce_to` (date, null)   // set when tag is deactivated
- `updated_at`

Constraints:
- `bay_id` must match an existing LoadTransformer bay_id
- Unique active tag per (substation, bay_id, category) where `is_inforce = true`
- If `is_inforce = true`, `inforce_from` must be set
- If `is_inforce = false`, `inforce_to` must be set

### 3) Evidence / Source (optional but recommended)
Table: `critical_source`
- `id` (uuid, pk)
- `reference` (string) // doc ID, ticket, memo
- `source_file` (file, nullable)
- `issued_date` (date, nullable)
- `notes` (text, optional)





## How it works
- For a **substation‑level** designation: insert tags for **all LoadTransformers** under the substation (e.g., ABBA132_T1, ABBA132_T2, ...).
- For **bay‑level** designation (e.g., `ABBA132_T1`): insert one tag for that bay.
- Multiple categories can coexist (e.g., Hospital + Rail).
- If a designation is removed, set `is_inforce = false`.

## Query patterns
- Current critical assets: `critical_asset_tag` where `is_inforce = true`.
- All critical bays under a substation: join `LoadTransformer` by substation.
- History for a bay: all tags for that bay ordered by `inforce_from` (fallback `updated_at`).

## Best‑practice rules
- `bay_id` should be validated against LoadTransformer only.
- Use `is_inforce` instead of deleting rows.
- Enforce **non‑overlap** for the same asset+category (unique current tag).
- Keep category list managed by admins (not free‑text).

## Example tags
- Substation critical (create tags for all LoadTransformers):
  - `substation=ABBA132`, `bay_id=ABBA132_T1`, `category=HOSPITAL`
  - `substation=ABBA132`, `bay_id=ABBA132_T2`, `category=HOSPITAL`
- Bay critical:
  - `substation=ABBA132`, `bay_id=ABBA132_T1`, `category=HOSPITAL`
  - `substation=ABBA132`, `bay_id=ABBA132_IOIM132_1`, `category=RAIL`
