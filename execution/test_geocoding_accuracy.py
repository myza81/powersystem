import requests
import json

def test_queries(queries):
    headers = {"User-Agent": "accuracy-test/1.0"}
    for q in queries:
        print(f"\nTesting Query: '{q}'")
        params = {"q": q, "format": "json", "addressdetails": 1, "limit": 3}
        try:
            r = requests.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
            data = r.json()
            if not data:
                print("  No results found.")
                continue
            for i, res in enumerate(data):
                print(f"  Result {i+1}:")
                print(f"    Display Name: {res['display_name']}")
                print(f"    Coords: ({res['lat']}, {res['lon']})")
                print(f"    Type: {res['type']}, Class: {res['class']}")
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    test_queries([
        "Abu Bakar Baginda, Malaysia",
        "PMU Abu Bakar Baginda, Malaysia",
        "TNB Abu Bakar Baginda, Malaysia",
        "Pencawang Masuk Utama Abu Bakar Baginda, Malaysia",
        "Tenaga Nasional Abu Bakar Baginda, Malaysia"
    ])
