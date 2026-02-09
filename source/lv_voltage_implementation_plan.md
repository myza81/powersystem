# Implementation Plan: Enforcing and Extracting LV Voltage

## Goal
To ensure `lv_voltage` is mandatory for all Transformers, editable in the UI, and automatically populated from SLD color codes where possible.

## 1. Backend Changes (`core/models.py`)
- **Modify `Transformer` Model**:
    - Change `lv_voltage` from `null=True, blank=True` to `null=False, blank=False`.
    - *Migration Strategy:* Since existing data may rely on `null`, we will need to provide a default value (e.g., `0`) or run a data cleanup script first.

## 2. Frontend Changes (`frontend/src/components/ConfigurationEditor.jsx`)
- **Update Transformers Interface**:
    - Add a new input column for **LV Voltage (kV)**.
    - Add a new input column for **Transformer Type** (optional but recommended for clarity).
    - Ensure `lv_voltage` is required before saving (validation).

## 3. SLD Parsing & Sync Logic
- **Verification of `dxf_parser.py`**:
    - The parser **already** attempts to extract voltage hints from geometry colors.
    - It maps:
        - **Red (1)** -> 33kV
        - **Purple (2)** -> 22kV
        - **Yellow (3)** -> 11kV
        - **Green (4)** -> 132kV
        - **Blue (5)** -> 275kV
        - **Black (6)** -> 500kV
- **Update Sync Service**:
    - Ensure that when a Transformer is detected (via text "Tx" or visual circle), the `voltage_hint` from the parser is used to populate `lv_voltage`.

## 4. Migration & Data Cleanup Plan
1.  **Data Cleanup Script**: Run a script to fill missing `lv_voltage` based on `transformer_type` (e.g., if type "132/11kV" -> set LV=11).
2.  **Migration**: Apply the model change to make the field mandatory.

## 5. Verification Plan
### Automated Tests
- Create a test case in `tests/test_transformer_model.py` attempting to save a Transformer without `lv_voltage` and asserting failure.
- Create a test case parsing a mock DXF with a Red circle and asserting it detects 33kV.

### Manual Verification
1.  **UI**: Open "Edit Configuration" for a substation. Confirm "LV Voltage" column exists. Try to save with it empty -> should fail/warn.
2.  **Parser**: Upload a colored SLD (e.g., `BRGS132.dxf`) and "Run Intelligence". Check if new transformers get `lv_voltage` populated automatically.
