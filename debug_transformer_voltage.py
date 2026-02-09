import sys
import os
import django
import traceback

try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
    django.setup()

    from core.models import Transformer

    print("--- Starting Check ---", file=sys.stderr)
    total = Transformer.objects.count()
    with_voltage = Transformer.objects.filter(lv_voltage__isnull=False).count()
    missing_voltage = total - with_voltage

    print(f"--- Transformer LV Voltage Check ---")
    print(f"Total Transformers: {total}")
    print(f"With LV Voltage: {with_voltage}")
    print(f"Missing LV Voltage: {missing_voltage}")

    if with_voltage > 0:
        print("\nSample Data (Name -> LV Voltage):")
        for t in Transformer.objects.filter(lv_voltage__isnull=False)[:10]:
            print(f"  {t.bay_name}: {t.lv_voltage} kV")
    else:
        print("\nNo LV voltage data found.")

except Exception:
    traceback.print_exc()

