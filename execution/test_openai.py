"""Test OpenAI provider with updated credits"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.sld_parser import SLDPipeline
from core.models import Substation
import json

print("Testing OpenAI LLM with updated credits...")
sub = Substation.objects.get(substation_id='ABBA132')

try:
    result = SLDPipeline.parse(
        sub.sld_file.path,
        use_llm=True,
        llm_provider='openai',
        validate=True
    )
    
    print("\nSUCCESS!")
    print(f"Transformers: {len(result.get('transformers', []))}/6")
    print(f"Bays: {len(result.get('incoming_bays', []))}/6")
    
    print("\nTransformers:")
    for t in result.get('transformers', []):
        print(f"  {t['transformer_id']}: HV={t.get('hv_breaker_number', 'N/A')}, LV={t.get('lv_breaker_number', 'N/A')}, Type={t.get('transformer_type', 'N/A')}, MVA={t.get('capacity_mva', 'N/A')}")
    
    print("\nBays:")
    for b in result.get('incoming_bays', []):
        print(f"  {b['bay_id']}: Breaker={b.get('breaker_number', 'N/A')}, Voltage={b.get('voltage', 'N/A')}kV")
    
    with open('/tmp/openai_result.json', 'w') as f:
        json.dump(result, f, indent=2)
    print("\nFull result saved to /tmp/openai_result.json")
    
except Exception as e:
    print(f"\nFAILED: {str(e)}")
    import traceback
    traceback.print_exc()
