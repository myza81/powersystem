import os
import sys
from dotenv import load_dotenv

# Setup Python path
sys.path.append(os.getcwd())
load_dotenv()

from services.geocoding import GeocodingService

def verify_hybrid_accuracy():
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    name = "Ara Damansara"
    
    print(f"Testing Hybrid Geocoding for: {name}")
    print(f"Google Maps API Key present: {'Yes' if api_key else 'No'}")
    
    try:
        lat, lng, state = GeocodingService.get_coordinates(name, "ADSA")
        print("\n--- Hybrid Result ---")
        print(f"  Coords: ({lat}, {lng})")
        print(f"  State: {state}")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == "__main__":
    verify_hybrid_accuracy()
