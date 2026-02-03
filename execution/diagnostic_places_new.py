import os
import requests
from dotenv import load_dotenv

load_dotenv()

def diagnostic_places_new():
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    query = "PMU Ara Damansara, Malaysia"
    url = "https://places.googleapis.com/v1/places:searchText"
    
    print(f"Testing Places API (New) for: {query}")
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location"
    }
    payload = {
        "textQuery": query
    }
    r = requests.post(url, json=payload, headers=headers)
    data = r.json()
    
    if data.get("places"):
        for i, res in enumerate(data["places"][:3]):
            print(f"\nResult {i+1}:")
            print(f"  Name: {res.get('displayName', {}).get('text')}")
            print(f"  Address: {res.get('formattedAddress')}")
            print(f"  Location: {res['location']}")
    else:
        print("No results in Places (New).")
        print(f"Full response: {data}")

if __name__ == "__main__":
    diagnostic_places_new()
