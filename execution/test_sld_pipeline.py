"""
Test script for SLD Pipeline - Fallback mode (no LLM required)
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.sld_parser import SLDPipeline
from core.models import Substation
import json

def test_abba132_fallback():
    """Test ABBA132.pdf parsing in fallback mode."""
    print("=" * 60)
    print("Testing SLD Pipeline - Fallback Mode (No LLM)")
    print("=" * 60)
    
    # Get ABBA132 substation
    try:
        sub = Substation.objects.get(substation_id='ABBA132')
        print(f"\n✓ Found substation: {sub.name}")
        print(f"✓ SLD File: {sub.sld_file.path}")
    except Substation.DoesNotExist:
        print("\n✗ ABBA132 not found in database")
        return
    
    # Run pipeline in fallback mode
    print("\n" + "-" * 60)
    print("Running OCR + Fallback Parser...")
    print("-" * 60)
    
    try:
        result = SLDPipeline.parse(
            sub.sld_file.path,
            use_llm=False,  # Use fallback mode
            validate=True    # Still validate against Instruction No.12
        )
        
        print("\n✓ Parsing completed successfully!")
        print(f"\nExtracted data:")
        print(f"  - Transformers: {len(result.get('transformers', []))}")
        print(f"  - Incoming Bays: {len(result.get('incoming_bays', []))}")
        
        if result.get('_fallback_mode'):
            print(f"\n⚠ Note: {result.get('_confidence_note')}")
        
        print("\n" + "=" * 60)
        print("Full JSON Output:")
        print("=" * 60)
        print(json.dumps(result, indent=2))
        
        # Show details
        print("\n" + "=" * 60)
        print("Transformer Details:")
        print("=" * 60)
        for t in result.get('transformers', []):
            print(f"\n{t['transformer_id']}:")
            print(f"  Type: {t.get('transformer_type', 'N/A')}")
            print(f"  Capacity: {t.get('capacity_mva', 'N/A')} MVA")
            print(f"  HV Breaker: {t.get('hv_breaker_number', 'N/A')}")
            print(f"  LV Breaker: {t.get('lv_breaker_number', 'N/A')}")
        
        print("\n" + "=" * 60)
        print("Incoming Bay Details:")
        print("=" * 60)
        for b in result.get('incoming_bays', []):
            print(f"\n{b['bay_id']}:")
            print(f"  Feeder: {b.get('feeder_name', 'N/A')}")
            print(f"  Voltage: {b.get('voltage', 'N/A')} kV")
            print(f"  Breaker: {b.get('breaker_number', 'N/A')}")
        
        return result
        
    except Exception as e:
        print(f"\n✗ Parsing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    test_abba132_fallback()
