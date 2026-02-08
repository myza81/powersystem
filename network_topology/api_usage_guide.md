# Network Topology API - Usage Guide

**Version**: 1.0  
**Base URL**: `/api/v1/network-topology/`  
**Authentication**: Required (Token or Session)

---

## API Endpoints

### 1. Get Pending Validations

**Endpoint**: `GET /api/v1/network-topology/pending_validations/`

**Description**: Retrieve all bays that require user validation

**Query Parameters**:
- `limit` (int, default: 50): Max results per page
- `offset` (int, default: 0): Pagination offset
- `confidence_min` (float): Minimum confidence filter
- `confidence_max` (float): Maximum confidence filter
- `connection_type` (string): Filter by type (STANDARD, TEE_OFF, etc.)

**Response**:
```json
{
  "total": 41,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "bay_id": "ATDC132_BBVT1",
      "bay_name": "BBVT1",
      "substation": {
        "substation_id": "ATDC132",
        "mnemonic": "ATDC",
        "name": "Ayer Tawar Distribution Centre",
        "voltage": 132
      },
      "connection_type": "UNKNOWN",
      "connected_to_substation": null,
      "tee_off_connections": [],
      "validation_status": "REJECTED",
      "auto_detected": true,
      "detection_confidence": 0.0,
      "detection_note": "No substation found with mnemonic 'BBVT'",
      "connection_summary": "Unknown - needs validation",
      "requires_validation": true,
      "topology_changed": false,
      "validated_by": null,
      "validated_at": null
    }
  ]
}
```

**Example Usage**:
```bash
# Get first 10 low-confidence cases
curl -H "Authorization: Token YOUR_TOKEN" \
  "http://localhost:8000/api/v1/network-topology/pending_validations/?limit=10&confidence_max=0.5"
```

---

### 2. Validate Connection

**Endpoint**: `POST /api/v1/network-topology/validate_connection/`

**Description**: Validate a single connection (approve, reject, or modify)

**Request Body**:
```json
{
  "bay_id": "ADAM132_SRDN1",
  "action": "approve",  // "approve" | "reject" | "modify"
  "note": "Verified with network diagram"  // optional
}
```

**For "modify" action**:
```json
{
  "bay_id": "ATDC132_BBVT1",
  "action": "modify",
  "connected_to_substation_id": "BBVT132",
  "connection_type": "STANDARD",
  "note": "Manually verified - BBVT substation exists"
}
```

**Response**:
```json
{
  "status": "approved",
  "bay_id": "ADAM132_SRDN1",
  "connection": "→ SRDN132"
}
```

**Example Usage**:
```bash
# Approve a connection
curl -X POST \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bay_id": "ADAM132_SRDN1", "action": "approve"}' \
  http://localhost:8000/api/v1/network-topology/validate_connection/

# Modify a connection
curl -X POST \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bay_id": "ATDC132_BBVT1",
    "action": "modify",
    "connected_to_substation_id": "BBVT132",
    "connection_type": "STANDARD",
    "note": "Added missing substation"
  }' \
  http://localhost:8000/api/v1/network-topology/validate_connection/
```

---

### 3. Bulk Validate

**Endpoint**: `POST /api/v1/network-topology/bulk_validate/`

**Description**: Bulk approve or reject multiple connections

**Request Body**:
```json
{
  "bay_ids": [
    "ADAM132_SRDN1",
    "ADAM132_SDCA1",
    "ADAM132_SDCA2"
  ],
  "action": "approve"  // "approve" | "reject"
}
```

**Response**:
```json
{
  "status": "success",
  "action": "approve",
  "updated": 3
}
```

**Example Usage**:
```bash
curl -X POST \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bay_ids": ["ADAM132_SRDN1", "ADAM132_SDCA1"],
    "action": "approve"
  }' \
  http://localhost:8000/api/v1/network-topology/bulk_validate/
```

---

### 4. Run Detection

**Endpoint**: `POST /api/v1/network-topology/run_detection/`

**Description**: Run auto-detection on all pending bays

**Request Body**: None

**Response**:
```json
{
  "status": "complete",
  "processed": 141,
  "auto_validated": 100,
  "pending_review": 0,
  "rejected": 41,
  "low_confidence_cases": 41,
  "details": [
    {
      "bay_id": "ATDC132_BBVT1",
      "bay_name": "BBVT1",
      "confidence": 0.0,
      "note": "No substation found with mnemonic 'BBVT'",
      "status": "REJECTED"
    }
  ]
}
```

**Example Usage**:
```bash
curl -X POST \
  -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8000/api/v1/network-topology/run_detection/
```

---

### 5. Check Changes

**Endpoint**: `POST /api/v1/network-topology/check_changes/`

**Description**: Check for topology changes in validated connections

**Request Body**: None

**Response**:
```json
{
  "status": "complete",
  "changes_detected": 2,
  "changes": [
    {
      "bay_id": "ADAM132_SRDN1",
      "old_connection": "SRDN132",
      "new_connection": "SRDN275",
      "confidence": 0.95
    }
  ]
}
```

**Example Usage**:
```bash
curl -X POST \
  -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8000/api/v1/network-topology/check_changes/
```

---

### 6. Statistics

**Endpoint**: `GET /api/v1/network-topology/statistics/`

**Description**: Get topology validation statistics

**Response**:
```json
{
  "total_bays": 141,
  "validation_status": {
    "auto_validated": 100,
    "user_validated": 0,
    "pending": 0,
    "rejected": 41,
    "topology_changed": 0
  },
  "connection_types": {
    "standard": 77,
    "tee_off": 7,
    "autotransformer": 15,
    "equipment": 6,
    "unknown": 36
  },
  "validation_rate": 70.9
}
```

**Example Usage**:
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8000/api/v1/network-topology/statistics/
```

---

## Admin Actions

Available in Django Admin (`/admin/core/incomingbay/`):

### 1. Approve Selected Connections
- **Action**: `approve_selected`
- **Description**: Bulk approve selected connections
- **Usage**: Select bays → Actions → "Approve selected connections"

### 2. Reject Selected Connections
- **Action**: `reject_selected`
- **Description**: Bulk reject selected connections
- **Usage**: Select bays → Actions → "Reject selected connections"

### 3. Re-run Detection
- **Action**: `redetect_selected`
- **Description**: Re-run topology detection on selected bays
- **Usage**: Select bays → Actions → "Re-run detection on selected bays"

---

## Workflow Examples

### Example 1: Review and Approve Low-Confidence Cases

```python
import requests

BASE_URL = "http://localhost:8000/api/v1/network-topology"
TOKEN = "your_auth_token"
headers = {"Authorization": f"Token {TOKEN}"}

# Step 1: Get pending validations
response = requests.get(
    f"{BASE_URL}/pending_validations/",
    params={"confidence_max": 0.5, "limit": 10},
    headers=headers
)
pending = response.json()['results']

# Step 2: Review each case
for bay in pending:
    print(f"Bay: {bay['bay_id']}")
    print(f"Note: {bay['detection_note']}")
    
    # User decision logic here
    action = "approve"  # or "reject" or "modify"
    
    # Step 3: Validate
    requests.post(
        f"{BASE_URL}/validate_connection/",
        json={"bay_id": bay['bay_id'], "action": action},
        headers=headers
    )
```

### Example 2: Bulk Approve High-Confidence Cases

```python
# Get all cases with confidence >= 0.90
response = requests.get(
    f"{BASE_URL}/pending_validations/",
    params={"confidence_min": 0.90},
    headers=headers
)

bay_ids = [bay['bay_id'] for bay in response.json()['results']]

# Bulk approve
requests.post(
    f"{BASE_URL}/bulk_validate/",
    json={"bay_ids": bay_ids, "action": "approve"},
    headers=headers
)
```

### Example 3: Periodic Change Detection

```python
# Run daily to detect topology changes
response = requests.post(
    f"{BASE_URL}/check_changes/",
    headers=headers
)

changes = response.json()['changes']

if changes:
    print(f"⚠️ {len(changes)} topology changes detected!")
    for change in changes:
        print(f"  {change['bay_id']}: {change['old_connection']} → {change['new_connection']}")
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "One or more substations not found"
}
```

### 404 Not Found
```json
{
  "error": "Bay INVALID_ID not found"
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

---

## Current Status (Test Results)

**Total Bays**: 141  
**Auto-Validated**: 100 (70.9%)  
**Requiring Review**: 41 (29.1%)

**Connection Types**:
- Standard: 77
- Tee-off: 7
- Autotransformer: 15
- Equipment: 6
- Unknown: 36

**Common Issues**:
1. Missing substations (BBVT, BYMS)
2. Ambiguous mnemonics (BDNG, SHAW, CBPS)
3. Partial tee-off resolution

---

**Last Updated**: 2026-02-08  
**API Version**: 1.0
