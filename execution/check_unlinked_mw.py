import os
import django
import sys

# Setup Django
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import NetworkSnapshot, NetworkLoad
from django.db.models import Sum

def list_unlinked_mw():
    snapshot = NetworkSnapshot.objects.order_by('-timestamp').first()
    unlinked_loads = snapshot.loads.filter(bus__substation__isnull=True).select_related('bus')
    
    print(f"{'Bus Name':<20} {'Voltage':<10} {'P MW':<10}")
    print("-" * 40)
    
    # Sort by p_mw desc
    loads = unlinked_loads.order_by('-p_mw')[:20]
    for load in loads:
        print(f"{load.bus.bus_name:<20} {load.bus.voltage:<10} {load.p_mw:<10.2f}")

if __name__ == "__main__":
    list_unlinked_mw()
