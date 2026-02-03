import os
import requests
from dotenv import load_dotenv

load_dotenv()

def diagnostic_places():
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    query = "PMU Ara Damansara, Malaysia"
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    
    print(f"Query: {query}")
    params = {"query": query, "key": api_key, "region": "my"}
    r = requests.get(url, params=params)
    data = r.json()
    
    print(f"Status: {data.get('status')}")
    if data.get("results"):
        for i, res in enumerate(data["results"][:3]):
            print(f"\nResult {i+1}:")
            print(f"  Name: {res.get('name')}")
            print(f"  Address: {res.get('formatted_address')}")
            print(f"  Location: {res['geometry']['location']}")
            print(f"  Types: {res.get('types')}")
    else:
        print("No results.")

if __name__ == "__main__":
    diagnostic_places()
