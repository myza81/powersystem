"""
Test LLM-enhanced SLD extraction with ABBA132.pdf
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

def test_llm_extraction():
    """Test LLM mode with ABBA132.pdf"""
    print("=" * 80)
    print("Testing LLM-Enhanced SLD Extraction")
    print("=" * 80)
    
    # Get ABBA132
    sub = Substation.objects.get(substation_id='ABBA132')
    print(f"\n✓ Substation: {sub.name}")
    print(f"✓ SLD File: {sub.sld_file.path}")
    
    # Check available providers
    providers = SLDPipeline.get_available_providers()
    print(f"\n✓ Available LLM Providers: {providers}")
    
    if not providers:
        print("\n✗ No LLM providers available. Check API keys in .env")
        return
    
    # Test with Gemini (preferred for free tier)
    provider = "gemini" if "gemini" in providers else providers[0]
    
    print(f"\n{'=' * 80}")
    print(f"Running pipeline with {provider.upper()}...")
    print(f"{'=' * 80}\n")
    
    try:
        result = SLDPipeline.parse(
            sub.sld_file.path,
            use_llm=True,
            llm_provider=provider,
            validate=True
        )
        
        print("\n✓ LLM Parsing COMPLETED!")
        
        # Compare with ground truth
        expected = {
            "transformers": 6,
            "bays": 6
        }
        
        actual = {
            "transformers": len(result.get('transformers', [])),
            "bays": len(result.get('incoming_bays', []))
        }
        
        print(f"\n{'=' * 80}")
        print("Extraction Results:")
        print(f"{'=' * 80}\n")
        print(f"  Transformers: {actual['transformers']}/6 expected")
        print(f"  Incoming Bays: {actual['bays']}/6 expected")
        
        accuracy = ((actual['transformers'] + actual['bays']) / 
                   (expected['transformers'] + expected['bays']) * 100)
        print(f"\n  Overall Accuracy: {accuracy:.1f}%")
        
        # Detailed breakdown
        print(f"\n{'=' * 80}")
        print("Transformer Details:")
        print(f"{'=' * 80}\n")
        
        for t in result.get('transformers', []):
            print(f"{t['transformer_id']}:")
            print(f"  Type: {t.get('transformer_type', 'N/A')}")
            print(f"  MVA: {t.get('capacity_mva', 'N/A')}")
            print(f"  HV Breaker: {t.get('hv_breaker_number', 'N/A')}")
            print(f"  LV Breaker: {t.get('lv_breaker_number', 'N/A')}")
            print()
        
        print(f"{'=' * 80}")
        print("Incoming Bay Details:")
        print(f"{'=' * 80}\n")
        
        for b in result.get('incoming_bays', []):
            print(f"{b['bay_id']}:")
            print(f"  Feeder: {b.get('feeder_name', 'N/A')}")
            print(f"  Voltage: {b.get('voltage', 'N/A')} kV")
            print(f"  Breaker: {b.get('breaker_number', 'N/A')}")
            print()
        
        # Validation check
        print(f"{'=' * 80}")
        print("Ground Truth Validation:")
        print(f"{'=' * 80}\n")
        
        # Expected data
        gt_transformers = {
            "T1": {"hv": "110", "lv": "31", "mva": 30, "type": "132/11kV"},
            "T2": {"hv": "210", "lv": "32", "mva": 30, "type": "132/11kV"},
            "T3": {"hv": "310", "lv": "3T0", "mva": 90, "type": "132/33kV"},
            "T4": {"hv": "410", "lv": "4T0", "mva": 90, "type": "132/33kV"},
            "T5": {"hv": "510", "lv": "5T0", "mva": 90, "type": "132/33kV"},
            "T6": {"hv": "610", "lv": "6T0", "mva": 90, "type": "132/33kV"},
        }
        
        gt_bays = {
            "SRDN1": "505", "SRDN2": "605",
            "IOIM1": "705", "IOIM2": "805",
            "PJYC1": "305", "PJYC2": "405"
        }
        
        t_matches = 0
        for t in result.get('transformers', []):
            tid = t['transformer_id']
            if tid in gt_transformers:
                gt = gt_transformers[tid]
                hv_match = t.get('hv_breaker_number') == gt['hv']
                if hv_match:
                    t_matches += 1
                    print(f"✓ {tid}: HV breaker matches")
                else:
                    print(f"✗ {tid}: HV breaker mismatch (got {t.get('hv_breaker_number')}, expected {gt['hv']})")
        
        b_matches = 0
        for b in result.get('incoming_bays', []):
            bid = b['bay_id']
            if bid in gt_bays:
                breaker_match = b.get('breaker_number') == gt_bays[bid]
                if breaker_match:
                    b_matches += 1
                    print(f"✓ {bid}: Breaker matches")
                else:
                    print(f"✗ {bid}: Breaker mismatch (got {b.get('breaker_number')}, expected {gt_bays[bid]})")
        
        print(f"\n{'=' * 80}")
        print(f"Validation Score: {t_matches + b_matches}/12 breakers correct")
        print(f"{'=' * 80}\n")
        
        return result
        
    except Exception as e:
        print(f"\n✗ LLM parsing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    test_llm_extraction()
