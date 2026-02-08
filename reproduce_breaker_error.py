import requests
import json

BASE_URL = "http://localhost:8000/api/v1"
SUBSTATION_ID = "BRGS132"

# emulate a payload with long breaker numbers
payload = {
    "name": "Beragas",
    "voltage": 132,
    "mnemonic": "BRGS",
    "incoming_bays": [
        {
            "bay_name": "Bay 1",
            "breaker_number": "5052/5051/5082" # This is > 10 chars
        }
    ]
}

print(f"Testing PATCH to {BASE_URL}/substations/{SUBSTATION_ID}/ with long breaker number...")
try:
    response = requests.patch(
        f"{BASE_URL}/substations/{SUBSTATION_ID}/", 
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
