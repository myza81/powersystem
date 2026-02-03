import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv()

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "powersystem_core.settings")
django.setup()

from services.substation_sync import SubstationSyncService
from core.models import Substation

def verify_sync_integrity():
    # 1. Ensure a base record exists for duplicate check
    Substation.objects.get_or_create(
        substation_id='ABBA132',
        defaults={'mnemonic': 'ABBA', 'name': 'Abu Bakar Baginda', 'voltage': 132, 'grid': 'KLUM'}
    )
    
    test_file = 'execution/test_sync_integrity.xlsx'
    print(f"Running Sync Integrity Test with: {test_file}")
    
    results = SubstationSyncService.sync_from_excel(test_file)
    
    print("\n--- Sync Results ---")
    print(f"Created: {results.get('created')}")
    print(f"Duplicates Skipped: {results.get('duplicates_skipped')}")
    print(f"Invalid Grid Skipped: {results.get('invalid_grid_skipped')}")
    print(f"Accuracy Warnings: {results.get('accuracy_warnings')}")
    
    print("\n--- Detailed Logs ---")
    for log in results.get('logs', []):
        print(f"  [LOG] {log}")
        
    print("\n--- Errors ---")
    for err in results.get('errors', []):
        print(f"  [ERR] {err}")

if __name__ == "__main__":
    verify_sync_integrity()
