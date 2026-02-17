import os
import django
import sys

# Setup Django
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation, NetworkSnapshot
from api.v1.serializers.substation import SubstationDetailSerializer

def audit_coverage():
    snap = NetworkSnapshot.objects.order_by('-timestamp').first()
    if not snap:
        print("No snapshots found.")
        return

    all_subs = Substation.objects.all()
    total = all_subs.count()
    has_load = 0
    has_tx = 0
    tx_count = 0
    total_mw = 0.0

    print(f"Auditing Snapshot: {snap.name}")
    print(f"Total Substation Assets: {total}")
    print("-" * 40)

    for s in all_subs:
        ser = SubstationDetailSerializer(s)
        load = ser.get_total_load_mw(s)
        txs = ser.get_transformers(s)
        
        if load > 0:
            has_load += 1
            total_mw += load
        if len(txs) > 0:
            has_tx += 1
            tx_count += len(txs)

    print(f"Substations with Load > 0: {has_load} ({100*has_load/total:.1f}%)")
    print(f"Substations with Transformers: {has_tx} ({100*has_tx/total:.1f}%)")
    print(f"Total Transformers Detected: {tx_count}")
    print(f"Total Snapshot Load: {total_mw:.2f} MW")
    print("-" * 40)
    
    # Check top 5 by load
    print("Top 5 Substations by Load:")
    top_load = sorted(all_subs, key=lambda s: SubstationDetailSerializer(s).get_total_load_mw(s), reverse=True)[:5]
    for s in top_load:
        l = SubstationDetailSerializer(s).get_total_load_mw(s)
        t = len(SubstationDetailSerializer(s).get_transformers(s))
        print(f"  {s.substation_id}: {l:.2f} MW ({t} TXs)")

if __name__ == "__main__":
    audit_coverage()
