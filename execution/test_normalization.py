import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv()

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "powersystem_core.settings")
django.setup()

from services.substation_sync import SubstationSyncService

def verify_normalization():
    print("Testing Header Normalization...")
    test_file = 'execution/test_normalization.xlsx'
    
    results = SubstationSyncService.sync_from_file(test_file)
    
    if 'error' in results:
        print(f"❌ FAILURE: {results['error']}")
    else:
        print(f"✅ SUCCESS: {results.get('created')} records created.")
        print(f"Logs: {results.get('logs')}")

if __name__ == "__main__":
    verify_normalization()
