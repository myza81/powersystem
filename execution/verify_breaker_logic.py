import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation, LoadTransformer

def verify():
    print("Starting verification of LoadTransformer breaker auto-population...")
    
    # 1. Create a dummy substation
    sub = Substation.objects.create(
        substation_id="TEST_SUB",
        mnemonic="TSUB",
        name="Test Substation",
        voltage=132
    )
    print(f"Created Substation: {sub}")

    try:
        # 2. Test 132/33kV Transformer (T1)
        lt1 = LoadTransformer.objects.create(
            substation=sub,
            transformer_no=1,
            lv_voltage=33
        )
        print(f"Created LT1: T{lt1.transformer_no}, LV={lt1.lv_voltage}V")
        print(f"  HV Breaker: {lt1.hv_breaker_number} (Expected: 110)")
        print(f"  LV Breaker: {lt1.lv_breaker_number} (Expected: 1T0)")
        assert lt1.hv_breaker_number == "110"
        assert lt1.lv_breaker_number == "1T0"

        # 3. Test 132/11kV Transformer (T2)
        lt2 = LoadTransformer.objects.create(
            substation=sub,
            transformer_no=2,
            lv_voltage=11
        )
        print(f"Created LT2: T{lt2.transformer_no}, LV={lt2.lv_voltage}V")
        print(f"  HV Breaker: {lt2.hv_breaker_number} (Expected: 210)")
        print(f"  LV Breaker: {lt2.lv_breaker_number} (Expected: 32)")
        assert lt2.hv_breaker_number == "210"
        assert lt2.lv_breaker_number == "32"

        # 4. Test 132/22kV Transformer (T3)
        lt3 = LoadTransformer.objects.create(
            substation=sub,
            transformer_no=3,
            lv_voltage=22
        )
        print(f"Created LT3: T{lt3.transformer_no}, LV={lt3.lv_voltage}V")
        print(f"  HV Breaker: {lt3.hv_breaker_number} (Expected: 310)")
        print(f"  LV Breaker: {lt3.lv_breaker_number} (Expected: 3T0)")
        assert lt3.hv_breaker_number == "310"
        assert lt3.lv_breaker_number == "3T0"

        # 5. Verify manual override is preserved
        lt4 = LoadTransformer.objects.create(
            substation=sub,
            transformer_no=4,
            lv_voltage=33,
            hv_breaker_number="MANUAL_HV",
            lv_breaker_number="MANUAL_LV"
        )
        print(f"Created LT4: T{lt4.transformer_no}, Manual Override")
        print(f"  HV Breaker: {lt4.hv_breaker_number} (Expected: MANUAL_HV)")
        print(f"  LV Breaker: {lt4.lv_breaker_number} (Expected: MANUAL_LV)")
        assert lt4.hv_breaker_number == "MANUAL_HV"
        assert lt4.lv_breaker_number == "MANUAL_LV"

        print("\nAll verifications passed successfully!")

    finally:
        # Cleanup
        sub.delete()
        print("Test data cleaned up.")

if __name__ == "__main__":
    verify()
