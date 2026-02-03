"""
Test OpenAI LLM extraction with ABBA132.pdf
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powerystem_core.settings')
django.setup()

from services.sld_parser import SLDPipeline
from core.models import Substation
import json

def test_openai():
    """Test with OpenAI"""
    print("Testing OpenAI LLM Extraction...")
    
    sub = Substation.objects.get(substation_id='ABBA132')
    print(f"✓ Substation: {sub.name}")
    
    # Test with OpenAI
    try:
        result = SLDPipeline.parse(
            sub.sld_file.path,
            use_llm=True,
            llm_provider="openai",
            validate=True
        )
        
        print(f"\n✓ Extraction Complete!")
        print(f"  Transformers: {len(result.get('transformers', []))}/6")
        print(f"  Bays: {len(result.get('incoming_bays', []))}/6")
        
        print("\n" + json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_openai()
