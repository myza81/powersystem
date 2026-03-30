import os
import django
import json

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import LoadSheddingVersion, LoadSheddingStage
from api.v1.serializers.shedding import LoadSheddingVersionSerializer

def verify_backend():
    print("--- Verifying Backend Model ---")
    try:
        # Check if field exists
        v = LoadSheddingVersion(scheme_type='UFLS', review_year=2026, target_percentage=45.5)
        print(f"Model instantiation with target_percentage=45.5: SUCCESS")
        
        # Test Serializer
        serializer = LoadSheddingVersionSerializer(v)
        data = serializer.data
        if 'target_percentage' in data and float(data['target_percentage']) == 45.5:
            print(f"Serializer includes target_percentage: SUCCESS")
        else:
            print(f"Serializer missing target_percentage or value mismatch: FAIL (Got {data.get('target_percentage')})")
            
    except Exception as e:
        print(f"Backend verification failed: {e}")

if __name__ == "__main__":
    verify_backend()
