import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.management import call_command
from django.http import JsonResponse
import logging
from core.utils.diff import get_fixture_diff

logger = logging.getLogger(__name__)

FIXTURE_PATH = os.path.join(settings.BASE_DIR, 'core', 'fixtures', 'initial_data.json')

class DatabaseSyncStatusView(APIView):
    def get(self, request):
        if not settings.DEBUG:
            return Response({"error": "Dev tools only available in DEBUG mode"}, status=status.HTTP_403_FORBIDDEN)
        
        diff = get_fixture_diff(FIXTURE_PATH)
        return Response(diff)

class DatabaseExportView(APIView):
    def post(self, request):
        if not settings.DEBUG:
            return Response({"error": "Dev tools only available in DEBUG mode"}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(FIXTURE_PATH), exist_ok=True)
            
            with open(FIXTURE_PATH, 'w') as f:
                call_command('dumpdata', 'core', indent=2, stdout=f)
            
            logger.info("Database exported successfully.")
            return Response({"message": "Database exported successfully.", "path": FIXTURE_PATH})
        except Exception as e:
            logger.error(f"Export failed: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DatabaseImportView(APIView):
    def post(self, request):
        if not settings.DEBUG:
            return Response({"error": "Dev tools only available in DEBUG mode"}, status=status.HTTP_403_FORBIDDEN)

        try:
            call_command('loaddata', FIXTURE_PATH)
            logger.info("Database imported successfully.")
            return Response({"message": "Database imported successfully."})
        except Exception as e:
            logger.error(f"Import failed: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
