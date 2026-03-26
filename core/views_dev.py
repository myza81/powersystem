import os
import json
from datetime import datetime, timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.management import call_command
from django.http import JsonResponse
import logging
from core.utils.diff import get_fixture_diff
from django.db.models import Max
from core.models import Substation, LoadTransformer, IncomingBranch, IncomingBranchAlias, AutoTransformer
from core.utils.geo import get_state_from_coordinates
from services.geocoding import GeocodingService

logger = logging.getLogger(__name__)

FIXTURE_PATH = os.path.join(settings.BASE_DIR, 'core', 'fixtures', 'initial_data.json')
BACKUP_DIR = os.path.join(settings.BASE_DIR, 'core', 'fixtures', 'backups')
DEFAULT_EXPORT_MODELS = [
    'core.Substation',
    'core.LoadTransformer',
    'core.IncomingBranch',
    'core.IncomingBranchAlias',
    'core.AutoTransformer',
    'core.CriticalCategory',
    'core.CriticalSource',
    'core.CriticalAsset',
    'core.LoadSheddingRelay',
    'core.LoadSheddingSetting',
    'core.LoadSheddingVersion',
    'core.LoadSheddingStage',
    'core.LoadSheddingStageSetting',
    'core.LoadSheddingTransformerBay',
    'core.LoadSheddingPocketBay',
    'core.LoadSheddingPocketBoundary',
]

def _get_latest_master_update_ts():
    from django.apps import apps
    candidates = []
    for model_str in DEFAULT_EXPORT_MODELS:
        try:
            model = apps.get_model(model_str)
            ts = model.objects.aggregate(ts=Max('updated_at'))['ts']
            if ts:
                candidates.append(ts)
        except Exception as e:
            logger.warning(f"Could not get updated_at for {model_str}: {e}")
    
    return max(candidates, default=None)

def _backup_master_fixture():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'initial_data_{ts}.json')
    with open(backup_path, 'w') as f:
        call_command('dumpdata', *DEFAULT_EXPORT_MODELS, indent=2, stdout=f)
    return backup_path

def _sync_substations_from_fixture(fixture_path, recompute_state=True, force_state=False):
    try:
        with open(fixture_path, 'r') as f:
            fixture_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"synced": 0, "updated": 0, "state_recomputed": 0, "error": "Invalid or missing fixture file."}

    substation_items = [item for item in fixture_data if item.get('model') == 'core.substation']
    if not substation_items:
        return {"synced": 0, "updated": 0, "state_recomputed": 0}

    pks = [item.get('pk') for item in substation_items if item.get('pk')]
    existing = {
        sub.substation_id: sub
        for sub in Substation.objects.filter(pk__in=pks).only('substation_id', 'latitude', 'longitude', 'state')
    }

    updated = 0
    state_refresh_ids = []

    for item in substation_items:
        pk = item.get('pk')
        fields = item.get('fields', {})
        if not pk:
            continue

        Substation.objects.filter(pk=pk).update(**fields)
        updated += 1

        if recompute_state:
            has_coords = fields.get('latitude') is not None and fields.get('longitude') is not None
            old = existing.get(pk)
            old_lat = str(old.latitude) if old and old.latitude is not None else None
            old_lng = str(old.longitude) if old and old.longitude is not None else None
            new_lat = fields.get('latitude')
            new_lng = fields.get('longitude')
            coords_changed = str(new_lat) != old_lat or str(new_lng) != old_lng
            needs_state = force_state or not fields.get('state') or coords_changed
            if has_coords and needs_state:
                state_refresh_ids.append(pk)

    state_recomputed = 0
    if recompute_state and state_refresh_ids:
        for sub in Substation.objects.filter(pk__in=state_refresh_ids).only('substation_id', 'latitude', 'longitude', 'grid', 'state'):
            if not sub.latitude or not sub.longitude:
                continue
            detected_state = GeocodingService.reverse_geocode(sub.latitude, sub.longitude)
            if not detected_state:
                detected_state = get_state_from_coordinates(sub.latitude, sub.longitude, grid=sub.grid)
            if detected_state and detected_state != sub.state:
                Substation.objects.filter(pk=sub.pk).update(state=detected_state)
                state_recomputed += 1

    return {"synced": len(substation_items), "updated": updated, "state_recomputed": state_recomputed}

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
            # Get models parameter, default to master data set
            models = request.data.get('models', DEFAULT_EXPORT_MODELS)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(FIXTURE_PATH), exist_ok=True)
            
            with open(FIXTURE_PATH, 'w') as f:
                # Export specified models
                call_command('dumpdata', *models, indent=2, stdout=f)
                logger.info(f"Database exported successfully (models: {', '.join(models)}).")
                return Response({
                    "message": f"Database exported successfully ({', '.join(models)}).", 
                    "path": FIXTURE_PATH,
                    "models": models
                })
        except Exception as e:
            logger.exception("Export failed")
            return Response(
                {"error": "Export failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class DatabaseImportView(APIView):
    def post(self, request):
        if not settings.DEBUG:
            return Response({"error": "Dev tools only available in DEBUG mode"}, status=status.HTTP_403_FORBIDDEN)

        try:
            reset_master = request.data.get('reset_master', False)
            force_import = request.data.get('force_import', False)

            if os.path.exists(FIXTURE_PATH):
                fixture_mtime = datetime.fromtimestamp(os.path.getmtime(FIXTURE_PATH), tz=timezone.utc)
            else:
                fixture_mtime = None

            latest_master_ts = _get_latest_master_update_ts()
            if fixture_mtime and latest_master_ts and fixture_mtime <= latest_master_ts and not force_import:
                return Response(
                    {"error": "Fixture appears older than local DB. Export your DB or enable force_import."},
                    status=status.HTTP_409_CONFLICT,
                )

            backup_path = _backup_master_fixture()

            if reset_master:
                # Delete in reverse order to respect dependencies
                # (e.g., delete child models before parent models)
                from core.models import (
                    LoadSheddingPocketBoundary, LoadSheddingPocketBay, LoadSheddingTransformerBay,
                    LoadSheddingStageSetting, LoadSheddingStage, LoadSheddingVersion,
                    LoadSheddingSetting, LoadSheddingRelay, CriticalAsset, CriticalSource,
                    CriticalCategory, IncomingBranchAlias, IncomingBranch, AutoTransformer,
                    LoadTransformer, Substation
                )
                
                # Group 1: Schemes & Bays
                LoadSheddingPocketBoundary.objects.all().delete()
                LoadSheddingPocketBay.objects.all().delete()
                LoadSheddingTransformerBay.objects.all().delete()
                LoadSheddingStageSetting.objects.all().delete()
                LoadSheddingStage.objects.all().delete()
                LoadSheddingVersion.objects.all().delete()
                
                # Group 2: Critical Assets
                CriticalAsset.objects.all().delete()
                CriticalSource.objects.all().delete()
                CriticalCategory.objects.all().delete()

                # Group 3: Core Infrastructure
                IncomingBranchAlias.objects.all().delete()
                IncomingBranch.objects.all().delete()
                AutoTransformer.objects.all().delete()
                LoadTransformer.objects.all().delete()
                LoadSheddingRelay.objects.all().delete()
                LoadSheddingSetting.objects.all().delete()
                Substation.objects.all().delete()

            call_command('loaddata', FIXTURE_PATH)
            recompute_state = request.data.get('recompute_state', True)
            force_state = request.data.get('force_state', False)
            sync_result = _sync_substations_from_fixture(FIXTURE_PATH, recompute_state=recompute_state, force_state=force_state)
            logger.info("Database imported successfully.")
            return Response({
                "message": "Database imported successfully.",
                "substations": sync_result,
                "reset_master": reset_master,
                "backup_path": backup_path,
            })
        except Exception as e:
            logger.exception("Import failed")
            return Response(
                {"error": "Import failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
