import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation

mnemonics = ['CBPS', 'OLPT']

for m in mnemonics:
    print(f"--- Checking {m} ---")
    substations = Substation.objects.filter(mnemonic=m)
    count = substations.count()
    print(f"Count: {count}")
    for s in substations:
        print(f"  ID: {s.substation_id}, Voltage: {s.voltage}kV, Name: {s.name}")
