import os
import django
import sys
import traceback
from django.test import RequestFactory
from django.contrib.auth import get_user_model

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem.settings')
django.setup()

from api.v1.views.load_analytics import LoadAnalyticsViewSet

User = get_user_model()

def debug_500():
    with open('debug_result.txt', 'w') as f:
        try:
            f.write("--- Debugging Load Analytics 500 ---\n")
            factory = RequestFactory()
            
            # 1. Create Request
            request = factory.get('/api/v1/load-analytics/aggregate/?level=grid')
            
            # Mock Anonymous User
            from django.contrib.auth.models import AnonymousUser
            request.user = AnonymousUser()
            
            f.write("Request created with AnonymousUser.\n")
            
            # 2. Instantiate View
            view = LoadAnalyticsViewSet.as_view({'get': 'aggregate'})
            
            # 3. Execute
            response = view(request)
            f.write(f"Response Status: {response.status_code}\n")
            
            if response.status_code >= 400:
                # If error, try to print data if available, or just the response
                if hasattr(response, 'data'):
                    f.write(f"Response Data: {response.data}\n")
                else:
                    f.write(f"Response Content: {response.content}\n")

        except Exception:
            f.write(traceback.format_exc())

if __name__ == "__main__":
    debug_500()
