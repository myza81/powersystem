import requests
import time
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class GeocodingError(Exception):
    """Custom exception for geocoding failures."""
    pass

class GeocodingService:
    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
    GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
    GOOGLE_PLACES_NEW_URL = "https://places.googleapis.com/v1/places:searchText"
    GOOGLE_PLACES_LEGACY_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

    @staticmethod
    def normalize_state(state_name):
        """
        Normalize state names to standard Malay spelling.
        """
        if not state_name:
            return None
            
        mapping = {
            "Malacca": "Melaka",
            "Penang": "Pulau Pinang",
            "Johore": "Johor",
            "Trengganu": "Terengganu",
            "Kelantan Darul Naim": "Kelantan",
            "Pahang Darul Makmur": "Pahang",
            "Perak Darul Ridzuan": "Perak",
            "Selangor Darul Ehsan": "Selangor",
            "Kedah Darul Aman": "Kedah",
            "Negeri Sembilan Darul Khusus": "Negeri Sembilan",
            "Perlis Indera Kayangan": "Perlis"
        }
        return mapping.get(state_name, state_name)

    @staticmethod
    def get_coordinates(name, mnemonic):
        """
        Hybrid Geocoding.
        Returns: (lat, lng, state)
        """
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        
        if api_key:
            # 1. Attempt Google Places (New)
            try:
                query = f"PMU {name}, Malaysia"
                headers = {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": "places.displayName,places.location,places.addressComponents"
                }
                payload = {"textQuery": query}
                response = requests.post(GeocodingService.GOOGLE_PLACES_NEW_URL, json=payload, headers=headers, timeout=10)
                data = response.json()

                if data.get("places"):
                    place = data["places"][0]
                    location = place.get("location", {})
                    lat, lng = location.get("latitude"), location.get("longitude")
                    
                    state = None
                    for component in place.get("addressComponents", []):
                        if "administrative_area_level_1" in component.get("types", []):
                            state = component.get("long_name")
                            break
                    if state:
                        state = GeocodingService.normalize_state(state)
                    logger.info(f"Google Places (New) success for {name}")
                    return lat, lng, state
            except Exception as e:
                logger.debug(f"Google Places (New) failed: {e}")

            # 2. Attempt Google Places (Legacy)
            try:
                query = f"PMU {name}, Malaysia"
                params = {"query": query, "key": api_key, "region": "my"}
                response = requests.get(GeocodingService.GOOGLE_PLACES_LEGACY_URL, params=params, timeout=10)
                data = response.json()
                if data.get("status") == "OK" and data.get("results"):
                    result = data["results"][0]
                    lat, lng = result["geometry"]["location"]["lat"], result["geometry"]["location"]["lng"]
                    
                    state = None
                    address = result.get("formatted_address", "")
                    for s in ["Selangor", "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Terengganu", "Kuala Lumpur", "Putrajaya"]:
                        if s in address:
                            state = s
                            break
                    if state:
                        state = GeocodingService.normalize_state(state)
                    logger.info(f"Google Places (Legacy) success for {name}")
                    return lat, lng, state
            except Exception as e:
                logger.debug(f"Google Places (Legacy) failed: {e}")

            # 3. Attempt Google Geocoding
            try:
                query = f"PMU {name}, Malaysia"
                params = {"address": query, "key": api_key, "region": "my"}
                response = requests.get(GeocodingService.GOOGLE_GEOCODE_URL, params=params, timeout=10)
                data = response.json()
                if data.get("status") == "OK":
                    result = data["results"][0]
                    lat, lng = result["geometry"]["location"]["lat"], result["geometry"]["location"]["lng"]
                        
                    state = None
                    for comp in result["address_components"]:
                        if "administrative_area_level_1" in comp["types"]:
                            state = comp["long_name"]
                            break
                    if state:
                        state = GeocodingService.normalize_state(state)
                    logger.info(f"Google Geocode success for {name}")
                    return lat, lng, state
            except Exception as e:
                logger.debug(f"Google Geocode failed: {e}")

        # 4. Fallback to OpenStreetMap/Nominatim
        logger.info(f"Falling back to OSM for {name}")
        headers = {"User-Agent": "power-system-grid-defense/1.0"}
        queries = [f"PMU {name}, Malaysia", f"{name}, Malaysia"]
        for query in queries:
            try:
                params = {"q": query, "format": "json", "limit": 1, "countrycodes": "my", "addressdetails": 1}
                time.sleep(1) 
                r = requests.get(GeocodingService.NOMINATIM_URL, params=params, headers=headers, timeout=10)
                data = r.json()
                if data:
                    item = data[0]
                    address = item.get("address", {})
                    state = address.get("state") or address.get("state_district")
                    if state:
                        state = GeocodingService.normalize_state(state)
                    return float(item["lat"]), float(item["lon"]), state
            except: continue

        raise GeocodingError(f"Could not find coordinates for {name} ({mnemonic})")

    @staticmethod
    def reverse_geocode(lat, lng):
        """
        Reverse Geocoding to get State name.
        Priority:
        1. OpenStreetMap (Nominatim)
        2. Google Maps Platform (if key available)
        
        Returns: state_name or None
        """
        # 1. OpenStreetMap (Primary)
        try:
            url = "https://nominatim.openstreetmap.org/reverse"
            headers = {"User-Agent": "power-system-grid-defense/1.0"}
            params = {"lat": lat, "lon": lng, "format": "json", "addressdetails": 1}
            # Strict timeout to avoid blocking save() too long
            response = requests.get(url, params=params, headers=headers, timeout=3)
            if response.status_code == 200:
                data = response.json()
                address = data.get("address", {})
                state = address.get("state") or address.get("state_district")
                if state:
                    logger.info(f"OSM Reverse Geocode success: {state}")
                    return GeocodingService.normalize_state(state)
        except Exception as e:
            logger.warning(f"OSM Reverse Geocode failed: {e}")

        # 2. Google Fallback
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        if api_key:
            try:
                params = {"latlng": f"{lat},{lng}", "key": api_key}
                response = requests.get(GeocodingService.GOOGLE_GEOCODE_URL, params=params, timeout=3)
                data = response.json()
                if data.get("status") == "OK":
                    for result in data["results"]:
                        for component in result["address_components"]:
                            if "administrative_area_level_1" in component["types"]:
                                state = component["long_name"]
                                logger.info(f"Google Reverse Geocode success: {state}")
                                return GeocodingService.normalize_state(state)
            except Exception as e:
                logger.error(f"Google Reverse Geocode error: {e}")

        return None
