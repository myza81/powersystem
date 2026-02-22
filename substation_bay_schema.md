# Substation Bay Master Schema (Draft)

Purpose: add master-level bay configuration (load transformers + incoming branches) tied to `Substation`, with snapshot-level state kept separate.

## Master tables

### LoadTransformer (master)
- `id` (uuid, pk)
- `substation` (fk -> `Substation`)
- `transformer_no` (int)
- `bay_id` (string, unique, auto)  // `{substation_id}_T{transformer_no}`
- `hv_voltage` (int, default from `substation.voltage`)
- `hv_breaker_number` (string, max 10, null) // flexible breaker ID (alphanumeric); e.g. 110, 210, 310
- `lv_voltage` (choice: 33/22/11, null)
- `lv_breaker_number` (string, max 10, null) // flexible breaker ID (alphanumeric); e.g. 1T0/2T0 (33/22kV), 31-35 (11kV)
- `capacity_mva` (int, null)
- `commissioning_date` (date, null)
- `created_at`, `updated_at`

Constraints:
- Unique together: (`substation`, `transformer_no`)
- Unique: `bay_id`

Auto-populate:
- `bay_id` is generated from `substation.substation_id` + `_T` + `transformer_no`
- `hv_voltage` defaults to `substation.voltage` on create

### IncomingBranch (master)
- `id` (uuid, pk)
- `substation` (fk -> `Substation`)       // local end
- `to_substation` (fk -> `Substation`)    // remote end
- `ckt_id` (string, max 2)                // e.g. 1, 2
- `breaker_number` (string, max 10, null) // flexible breaker ID (alphanumeric); e.g. 105, 205, L25, 4130, Z3130
- `bay_id` (string, unique, auto)         // `{from_id}_{to_id}_{ckt_id}`
- `commissioning_date` (date, null)
- `created_at`, `updated_at`

Constraints:
- Unique together: (`substation`, `to_substation`, `ckt_id`)
- Unique: `bay_id`

Auto-populate:
- `bay_id` is generated from `substation.substation_id`, `to_substation.substation_id`, `ckt_id`

Use-case note:
- `IncomingBranch` is for line/cable bays only. Do not model auto-transformers here.

### AutoTransformer (master)
For 275/500 kV substations with interconnection transformers between voltage levels.

- `id` (uuid, pk)
- `substation` (fk -> `Substation`)       // HV bus location
- `transformer_no` (int)
- `bay_id` (string, unique, auto)         // `{substation_id}_AT{transformer_no}`
- `hv_voltage` (int)                      // 500 or 275 (from Substation.voltage)
- `hv_breaker_number` (string, max 10, null) // flexible breaker ID (alphanumeric); e.g. 110, 210, 310
- `lv_voltage` (int)                      // 275 or 132
- `lv_breaker_number` (string, max 10, null) // flexible breaker ID (alphanumeric); e.g. 1T0/2T0 (33/22kV), 31-35 (11kV)
- `capacity_mva` (int, null)
- `commissioning_date` (date, null)
- `created_at`, `updated_at`

Constraints:
- Unique together: (`substation`, `transformer_no`)
- Unique: `bay_id`

Auto-populate:
- `bay_id` is generated deterministically; format should be fixed and validated.

## Snapshot linkage (no changes to existing snapshot tables)

### EquipmentTopologyMap
Links master equipment to topology objects per topology version.

- `id` (uuid, pk)
- `topology_version` (fk -> `TopologyVersion`)
- `equipment_type` (enum: `load_transformer`, `branch`)
- `load_transformer` (fk -> `LoadTransformer`, null)
- `incoming_branch` (fk -> `IncomingBranch`, null)
- `topology_transformer` (fk -> `TopologyTransformer`, null)
- `topology_branch` (fk -> `TopologyBranch`, null)
- `created_at`

Constraints:
- Exactly one master FK is set (load_transformer xor incoming_branch)
- Exactly one topology FK is set (topology_transformer xor topology_branch)
- Unique together: (`topology_version`, `equipment_type`, `load_transformer`)
- Unique together: (`topology_version`, `equipment_type`, `incoming_branch`)

## Snapshot state (optional, only if you want to override topology.is_active)

### EquipmentSnapshotState
- `id` (uuid, pk)
- `snapshot` (fk -> `NetworkSnapshot`)
- `equipment_type` (enum: `load_transformer`, `branch`)
- `load_transformer` (fk -> `LoadTransformer`, null)
- `incoming_branch` (fk -> `IncomingBranch`, null)
- `in_service` (bool)
- `state_source` (enum: `snapshot`, `manual`, `scada`, optional)
- `updated_at`

Notes:
- If you are already using `TopologyBranch.is_active` and `TopologyTransformer.is_active`, you can skip this table and derive state directly from topology per snapshot/topology version.

## Validation rules
- `bay_id` must be deterministic and auto-generated; no manual edits.
- `bay_id` format should be validated by regex to prevent drift.
- Mapping should only point to topology elements in the same `topology_version` as the target snapshot.

## Alignment with existing schema (no duplication)
- `Substation` remains the master site table; these new models only add bay-level metadata.
- Electrical parameters (r/x/b, ratings, topology connectivity) stay in `TopologyBranch` and `TopologyTransformer` per `TopologyVersion`.
- Master models store only stable identifiers and nameplate info (e.g. capacity, commissioning).
- Snapshot state should be derived from `TopologyBranch.is_active` / `TopologyTransformer.is_active` whenever possible.
- `NetworkSnapshot` already points to `TopologyVersion`, so master↔topology mapping should use `TopologyVersion` to avoid snapshot coupling.

## Bay ID changes over time
When a bay changes remote end (e.g. ABBA132-IOIM132 becomes ABBA132-PJYC132), keep the master row and record ID history.

### IncomingBranchAlias
- `id` (uuid, pk)
- `incoming_branch` (fk -> `IncomingBranch`)
- `bay_id` (string, unique)
- `effective_from` (date)
- `effective_to` (date, null)

Rules:
- Current `IncomingBranch.bay_id` must match the active alias (`effective_to is null`).
- On change, close the old alias and create a new one. Master PK remains unchanged.

## Example bay_id
- Load transformer: `ABBA132_T1`
- Incoming branch: `ABBA132_IOIM132_1`
