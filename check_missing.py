import os
import django
import sys
import json
import traceback

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from api.v1.views.load_analytics import LoadAnalyticsViewSet

with open('/Volumes/externalDrive/code-gym/powersystem/output_check.txt', 'w') as f:
    try:
        f.write("Starting script execution...\n")
        factory = APIRequestFactory()
        request = factory.get('/api/v1/load-analytics/missing-substations/')
        view = LoadAnalyticsViewSet.as_view({'get': 'missing_substations'})
        response = view(request)
        if hasattr(response, 'data'):
            f.write(json.dumps(response.data, indent=2))
        else:
            f.write(str(response))
    except Exception:
        f.write(traceback.format_exc())
