import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv()

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "powersystem_core.settings")
django.setup()

from services.substation_sync import SubstationSyncService

def test_formats():
    print("Testing Multi-Format Sync...")
    
    # 1. Test CSV
    print("\nTesting CSV Sync:")
    csv_file = 'execution/test_sync_csv.csv'
    results = SubstationSyncService.sync_from_file(csv_file)
    print(f"CSV Result: {results.get('created')} created, {results.get('errors', [])} errors")

    # 2. Test Excel
    print("\nTesting Excel Sync:")
    excel_file = 'execution/test_sync_integrity.xlsx' # Re-use existing test file
    results = SubstationSyncService.sync_from_file(excel_file)
    print(f"Excel Result: {results.get('created')} created, {len(results.get('logs', []))} logs")

if __name__ == "__main__":
    test_formats()
