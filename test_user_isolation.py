import os
import django
import sys
import logging

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import NetworkSnapshot
from api.v1.views.snapshot import SnapshotViewSet
from rest_framework.test import APIRequestFactory, force_authenticate
import traceback

User = get_user_model()

def test_user_isolation():
    print("--- Starting User Isolation Test ---")
    
    try:
        # 1. Create Users
        user_a, _ = User.objects.get_or_create(username='user_a_test', email='a@test.com')
        user_b, _ = User.objects.get_or_create(username='user_b_test', email='b@test.com')
        print("Created/Retrieved User A and User B.")
        
        # 2. Assign Snapshots directly (simulating upload)
        snap_a = NetworkSnapshot.objects.create(name="Snapshot A", created_by=user_a)
        snap_b = NetworkSnapshot.objects.create(name="Snapshot B", created_by=user_b)
        print(f"Created Snapshot A ({snap_a.id}) for User A.")
        print(f"Created Snapshot B ({snap_b.id}) for User B.")
        
        # 3. Test ViewSet Logic (get_queryset) via RequestFactory
        factory = APIRequestFactory()
        view = SnapshotViewSet.as_view({'get': 'list'})
        
        # --- Emulate User A ---
        request_a = factory.get('/api/v1/snapshots/')
        force_authenticate(request_a, user=user_a)
        response_a = view(request_a)
        
        data_a = response_a.data
        results_a = data_a.get('results', data_a) if isinstance(data_a, dict) else data_a
        
        ids_a = [str(item['id']) for item in results_a]
        print(f"User A sees IDs: {ids_a}")
        
        if str(snap_a.id) in ids_a and str(snap_b.id) not in ids_a:
            print("PASS: User A sees only their snapshot.")
        else:
            print(f"FAIL: User A visibility incorrect. Expected {snap_a.id}, got {ids_a}")
            
        # --- Emulate User B ---
        # Need new request for User B
        request_b = factory.get('/api/v1/snapshots/')
        force_authenticate(request_b, user=user_b)
        response_b = view(request_b)
        
        data_b = response_b.data
        results_b = data_b.get('results', data_b) if isinstance(data_b, dict) else data_b
        
        ids_b = [str(item['id']) for item in results_b]
        print(f"User B sees IDs: {ids_b}")

        if str(snap_b.id) in ids_b and str(snap_a.id) not in ids_b:
            print("PASS: User B sees only their snapshot.")
        else:
            print(f"FAIL: User B visibility incorrect.")
            
        # Cleanup
        snap_a.delete()
        snap_b.delete()
        print("Cleaned up test snapshots.")

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    test_user_isolation()
