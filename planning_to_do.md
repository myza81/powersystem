# Bay Master Rollout Plan

1. Populate master tables: `LoadTransformer`, `IncomingBranch`, `AutoTransformer`.
2. Backfill mapping for existing topology versions (management command to generate `EquipmentTopologyMap`).
3. Backfill snapshot state for existing snapshots (generate `EquipmentSnapshotState`).
4. Verify new imports auto-create mapping/state.
