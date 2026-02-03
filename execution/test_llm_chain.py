"""
Test LLM chain: OpenAI (primary) → Gemini (secondary) → Fallback
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.sld_parser import SLDPipeline
from core.models import Substation
import json

def test_llm_chain():
    """Test OpenAI → Gemini → Fallback chain"""
    
    print("=" * 80)
    print("Testing LLM Provider Chain")
    print("=" * 80)
    
    sub = Substation.objects.get(substation_id='ABBA132')
    print(f"\n✓ Substation: {sub.name}")
    print(f"✓ SLD File: {sub.sld_file.path}")
    
    # Check API keys
    print("\n" + "-" * 80)
    print("Checking API Configuration:")
    print("-" * 80)
    
    import os
    openai_key = os.getenv('OPENAI_API_KEY')
    gemini_key = os.getenv('GEMINI_API_KEY')
    
    print(f"OPENAI_API_KEY: {'✓ SET' if openai_key else '✗ NOT SET'}")
    print(f"GEMINI_API_KEY: {'✓ SET' if gemini_key else '✗ NOT SET'}")
    
    # Test 1: Try OpenAI (primary)
    print("\n" + "=" * 80)
    print("TEST 1: OpenAI (Primary)")
    print("=" * 80)
    
    if openai_key:
        try:
            result = SLDPipeline.parse(
                sub.sld_file.path,
                use_llm=True,
                llm_provider="openai",
                validate=True
            )
            
            print("\n✓ OpenAI parsing SUCCEEDED!")
            print(f"  Transformers: {len(result.get('transformers', []))}/6")
            print(f"  Bays: {len(result.get('incoming_bays', []))}/6")
            
            print("\nTransformers extracted:")
            for t in result.get('transformers', []):
                print(f"  - {t['transformer_id']}: HV={t.get('hv_breaker_number', 'N/A')}, Type={t.get('transformer_type', 'N/A')}")
            
            print("\nBays extracted:")
            for b in result.get('incoming_bays', []):
                print(f"  - {b['bay_id']}: Breaker={b.get('breaker_number', 'N/A')}")
            
            return result
            
        except Exception as e:
            print(f"\n✗ OpenAI parsing FAILED: {str(e)}")
            print("\nFalling back to Gemini...")
    else:
        print("\n✗ OpenAI API key not set, skipping")
    
    # Test 2: Try Gemini (secondary)
    print("\n" + "=" * 80)
    print("TEST 2: Gemini (Secondary)")
    print("=" * 80)
    
    if gemini_key:
        try:
            result = SLDPipeline.parse(
                sub.sld_file.path,
                use_llm=True,
                llm_provider="gemini",
                validate=True
            )
            
            print("\n✓ Gemini parsing SUCCEEDED!")
            print(f"  Transformers: {len(result.get('transformers', []))}/6")
            print(f"  Bays: {len(result.get('incoming_bays', []))}/6")
            
            return result
            
        except Exception as e:
            print(f"\n✗ Gemini parsing FAILED: {str(e)}")
            print("\nFalling back to rule-based parser...")
    else:
        print("\n✗ Gemini API key not set, skipping")
    
    # Test 3: Rule-based fallback
    print("\n" + "=" * 80)
    print("TEST 3: Rule-Based Fallback")
    print("=" * 80)
    
    result = SLDPipeline.parse(
        sub.sld_file.path,
        use_llm=False,
        validate=True
    )
    
    print("\n✓ Fallback parsing completed")
    print(f"  Transformers: {len(result.get('transformers', []))}/6")
    print(f"  Bays: {len(result.get('incoming_bays', []))}/6")
    
    return result


if __name__ == "__main__":
    test_llm_chain()
