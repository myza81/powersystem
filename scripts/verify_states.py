import os
import sys
import django
import requests
import json

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation

def verify_states():
    print("--- Database States ---")
    states = Substation.objects.exclude(state__isnull=True).exclude(state='').values_list('state', flat=True).distinct().order_by('state')
    for s in states:
        print(f"- {s}")

    print("\n--- API Response States ---")
    try:
        response = requests.get('http://127.0.0.1:8000/api/v1/load-profiles/aggregate/?level=grid')
        if response.status_code == 200:
            data = response.json()
            if 'state_breakdown' in data:
                api_states = [item['state'] for item in data['state_breakdown']]
                api_states.sort()
                for s in api_states:
                    print(f"- {s}")
            else:
                print("No 'state_breakdown' in API response.")
        else:
            print(f"API Request failed: {response.status_code}")
    except Exception as e:
        print(f"API Request Error: {e}")

if __name__ == "__main__":
    verify_states()
