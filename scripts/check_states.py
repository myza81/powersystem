import os
import sys
import django
from django.db.models import Count, Q

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation

def check_state_data():
    total = Substation.objects.count()
    with_state = Substation.objects.filter(state__isnull=False).exclude(state='').count()
    
    print(f"Total Substations: {total}")
    print(f"Substations with State: {with_state}")
    
    if with_state < total:
        print("\nMissing State Data:")
        missing = Substation.objects.filter(Q(state__isnull=True) | Q(state='')).values('substation_id', 'name', 'latitude', 'longitude')[:10]
        for m in missing:
            print(f"- {m['substation_id']} ({m['name']}): Lat={m['latitude']}, Long={m['longitude']}")
            
    print("\nState Distribution:")
    dist = Substation.objects.exclude(state__isnull=True).values('state').annotate(count=Count('pk')).order_by('-count')
    for d in dist:
        print(f"- {d['state'] or 'None'}: {d['count']}")

    from core.models import BayLoad
    print("\nBayLoad State Coverage:")
    matched_loads = BayLoad.objects.filter(matched=True)
    total_matched = matched_loads.count()
    print(f"Total Matched Loads: {total_matched}")
    
    # Check loads with value > 0
    active_loads = matched_loads.filter(pload_mw__gt=0)
    print(f"Active Matched Loads (>0 MW): {active_loads.count()}")
    
    # Check if they have state via transformer
    via_tf = active_loads.filter(transformer__substation__state__isnull=False).count()
    print(f"Loads with State via Transformer: {via_tf}")
    
    # Check if they have state via incoming bay
    via_bay = active_loads.filter(incoming_bay__substation__state__isnull=False).count()
    print(f"Loads with State via Incoming Bay: {via_bay}")

if __name__ == "__main__":
    check_state_data()
