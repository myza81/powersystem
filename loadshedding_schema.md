# Load Shedding Schema - Critical Substations/Transformers

Purpose: model critical substations and transformers that supply critical customers (hospital, public transport, etc.) with periodic review, traceability, and stable references across snapshots.

## Design goals
- Dynamic classification: easy to add/remove critical status without deleting history
- Robust review: capture review cycles, decisions, and effective dates
- Stable identifiers: link by asset IDs, not by snapshot-only objects
- Auditability: who changed what and why
- Extensible: add customer categories, evidence sources, and rules over time

## Core entities (tied to existing models)

### 1) Existing asset tables
Reuse your current master + topology tables so the schema is grounded in what already exists.

Existing:
- `Substation` (core.models.Substation)  // master entity, stable key: `substation_id`
- `TopologyTransformer` (core.models.TopologyTransformer)  // topology-versioned transformer
- `TopologyVersion` (core.models.TopologyVersion)

Rationale:
- Substations are already master data and stable.
- Transformers are already modeled in topology; use the transformer FK and keep the topology version for traceability.

### 2) Critical customer category
Table: `critical_customer_type`
- `id` (uuid, pk)
- `code` (string, unique)  // e.g. HOSPITAL, RAIL, AIRPORT, WATER
- `name` (string)
- `description` (text, optional)
- `severity_rank` (int, optional)  // 1 = highest priority
- `is_active` (bool, default true)

### 3) Critical tag (current state)
Table: `critical_tag`
- `id` (uuid, pk)
- `substation` (fk -> `Substation`, nullable)
- `transformer` (fk -> `TopologyTransformer`, nullable)
- `topology_version` (fk -> `TopologyVersion`, nullable)  // snapshot of topology at time of tagging
- `customer_type_id` (fk -> `critical_customer_type`)
- `is_critical` (bool, default true)
- `effective_from` (date)
- `effective_to` (date, nullable)
- `confidence` (enum: `low`, `medium`, `high`)
- `notes` (text, optional)
- `review_status` (enum: `pending`, `approved`, `rejected`)
- `review_cycle_id` (fk -> `critical_review_cycle`, nullable)
- `source_id` (fk -> `critical_source`, nullable)
- `created_by`, `updated_by` (fk -> user)
- `created_at`, `updated_at`

Constraints:
- Exactly one of `substation` or `transformer` must be set
- Unique current tag per (substation or transformer) + customer_type where `effective_to` is null
- `effective_to` must be >= `effective_from`

Integrity rules (service layer):
- If `transformer` is set, `topology_version` should match `transformer.topology_version`.
- If `transformer` is set, `substation` is optional but should match `transformer.from_bus.substation` or `to_bus.substation`.

### 4) Review cycle and decision history
Table: `critical_review_cycle`
- `id` (uuid, pk)
- `name` (string)  // e.g. 2026-H1 Review
- `start_date`, `end_date`
- `status` (enum: `open`, `closed`)
- `created_by`, `created_at`

Table: `critical_review_decision`
- `id` (uuid, pk)
- `review_cycle_id` (fk)
- `substation` (fk -> `Substation`, nullable)
- `transformer` (fk -> `TopologyTransformer`, nullable)
- `customer_type_id` (fk)
- `decision` (enum: `confirm`, `add`, `remove`, `downgrade`, `upgrade`)
- `decision_notes` (text, optional)
- `decided_by` (fk -> user)
- `decided_at` (datetime)

Notes:
- Decisions are immutable; they generate or close `critical_tag` rows.
- Keeps full audit trail even if tags change later.

### 5) Evidence sources (optional but recommended)
Table: `critical_source`
- `id` (uuid, pk)
- `source_type` (enum: `regulator`, `utility`, `customer_request`, `field_survey`)
- `reference` (string)  // document id or ticket
- `url` (string, nullable)
- `issued_date` (date, nullable)
- `notes` (text, optional)

## How tagging works
- Each critical designation is a `critical_tag` row with effective dates tied to `Substation` or `TopologyTransformer`.
- Review cycles create `critical_review_decision` rows; approvals update `critical_tag`:
  - add or upgrade -> open a new tag (`effective_from = decision date`, `effective_to = null`)
  - remove or downgrade -> close existing tag (`effective_to = decision date`)
- A substation or transformer can have multiple customer types simultaneously.

## Query patterns
- Current critical assets: `critical_tag` where `effective_to is null` and `is_critical = true` and `review_status = approved`.
- Critical by type: join `critical_customer_type`.
- History: all `critical_tag` rows for an asset ordered by `effective_from`.

## Best-practice considerations
- Use `substation_id` and `TopologyTransformer.id` as stable keys for API payloads.
- Avoid snapshot-only objects; tie to `TopologyVersion` for traceability when tagging transformers.
- Keep decision history immutable to preserve audit trails.
- Use indices on `substation`, `transformer`, `customer_type_id`, `effective_to` for fast queries.

## Minimal implementation path
1) Add `critical_customer_type` with base categories.
2) Add `critical_tag` (FK to Substation/TopologyTransformer) with effective dates and review status.
3) Add review cycle + decision tables.
4) Update admin and API endpoints for tagging and review workflows.
