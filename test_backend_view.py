import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "powersystem_core.settings")
django.setup()

from api.v1.views.load_analytics import LoadAnalyticsViewSet
from django.test import RequestFactory
from django.contrib.auth.models import User
from core.models import NetworkSnapshot

try:
    # Create a dummy request
    factory = RequestFactory()
    request = factory.get('/api/v1/load-analytics/missing-substations/')
    
    # Ensure a user exists
    user = User.objects.first()
    if not user:
        user = User.objects.create(username='test_admin')
    request.user = user

    # Instantiate view
    view = LoadAnalyticsViewSet()
    view.request = request
    view.format_kwarg = None

    # Test _get_snapshot
    print("Testing _get_snapshot...")
    snapshot = NetworkSnapshot.objects.first()
    
    if snapshot:
        # Test with ID
        print(f"Testing specific snapshot ID: {snapshot.id}")
        result = view._get_snapshot(request, str(snapshot.id))
        print(f"Result (by ID): {result}")
        assert result == snapshot, "Failed to retrieve snapshot by ID"

        # Test latest (no ID)
        print("Testing latest snapshot retrieval...")
        result_latest = view._get_snapshot(request)
        print(f"Result (latest): {result_latest}")
        assert result_latest is not None, "Failed to retrieve latest snapshot"
        
    else:
        print("No snapshots available in DB to test.")
    
    print("SUCCESS: _get_snapshot method works correctly.")

except Exception as e:
    print(f"FAILURE: {e}")
    import traceback
    traceback.print_exc()
