import os
import django
import json
from django.test import RequestFactory
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth.models import User

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "powersystem.settings")
django.setup()

from api.v1.views.snapshot import SnapshotViewSet

def test_snapshot_api():
    factory = APIRequestFactory()
    view = SnapshotViewSet.as_view({'get': 'list'})

    # Create a user
    user = User.objects.first()
    if not user:
        user = User.objects.create(username='test_admin')
    
    request = factory.get('/api/v1/snapshots/')
    force_authenticate(request, user=user)
    
    response = view(request)
    print("Status Code:", response.status_code)
    if response.status_code == 200:
        data = response.data
        if data:
            print("First Snapshot Data:")
            print(json.dumps(data[0], indent=2, use_decimal=True, default=str))
        else:
            print("No snapshots found.")
    else:
        print("Error:", response.data)

if __name__ == "__main__":
    try:
        test_snapshot_api()
    except Exception as e:
        print(f"Error: {e}")
