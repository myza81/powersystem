import sys
from decimal import Decimal
import time

# Mocking the updated service for demonstration
class GeocodingService:
    @staticmethod
    def get_coordinates(name, mnemonic):
        print(f"  [Rate Limit] Waiting 1s before geocoding {name}...")
        time.sleep(1)
        if "KL" in name or "Kuala Lumpur" in name:
            return 3.1390, 101.6869, "Kuala Lumpur"
        if "Kedah" in name or "KLS" in mnemonic:
            return 6.1184, 100.3686, "Kedah"
        return None, None, None

def get_region_for_grid(grid_code):
    region_map = {
        'North': ['KEDP', 'PPNG', 'PERK'],
        'Central': ['SELG', 'KLUM'],
        'South': ['NSEM', 'MLKA', 'JOH2', 'JOH1'],
        'East': ['PHNG', 'TERG', 'KELN'],
    }
    for region, codes in region_map.items():
        if grid_code in codes:
            return region
    return None

class MockSubstation:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        # Use the same derivation logic as the model save()
        self.region = get_region_for_grid(self.grid) if hasattr(self, 'grid') else None
        
    def save(self):
        print(f"  [DB] Saved {self.substation_id}:")
        print(f"       Grid: {self.grid}")
        print(f"       Region: {self.region}")
        print(f"       State: {self.state}")
        print(f"       Loc: ({self.latitude}, {self.longitude})")

def test_metadata_sync():
    print("Verifying Metadata Expansion (Grid, State, Region)...")
    
    rows = [
        {"name": "Pencawang KL South", "mnemonic": "KLS", "voltage": 275, "grid": "KLUM"},
        {"name": "Kedah North Asset", "mnemonic": "KDN", "voltage": 132, "grid": "KEDP"},
    ]
    
    for row in rows:
        name = row['name']
        mnemonic = row['mnemonic']
        voltage = Decimal(str(row['voltage']))
        grid = row['grid']
        substation_id = f"{mnemonic}{voltage}"
        
        print(f"\nProcessing {substation_id}...")
        
        lat, lng, state = None, None, None
        try:
            lat, lng, state = GeocodingService.get_coordinates(name, mnemonic)
        except Exception as e:
            print(f"  [Error] {str(e)}")
        
        sub = MockSubstation(
            substation_id=substation_id,
            grid=grid,
            state=state,
            latitude=lat,
            longitude=lng
        )
        sub.save()

if __name__ == "__main__":
    start_time = time.time()
    test_metadata_sync()
    duration = time.time() - start_time
    print(f"\nVerification Complete. Total Duration: {duration:.2f}s")
