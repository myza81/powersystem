"""
Diagnostic script to analyze OCR extraction from ABBA132.pdf
Shows what text is being extracted and at what confidence levels.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.sld_parser.image_utils import pdf_to_images, preprocess_image
from services.sld_parser.ocr_extractor import extract_text_with_boxes
from services.sld_parser.visual_detector import detect_colored_conductors
from core.models import Substation
import json

def diagnostic_ocr():
    """Analyze what OCR is actually extracting from ABBA132.pdf"""
    
    print("=" * 80)
    print("OCR Diagnostic for ABBA132.pdf")
    print("=" * 80)
    
    sub = Substation.objects.get(substation_id='ABBA132')
    pdf_path = sub.sld_file.path
    
    print(f"\nPDF Path: {pdf_path}")
    
    # Convert and preprocess
    images = pdf_to_images(pdf_path, dpi=300)
    color_img, binary_img = preprocess_image(images[0])
    
    print(f"Image dimensions: {color_img.shape}")
    
    # Extract text
    texts = extract_text_with_boxes(binary_img)
    
    print(f"\n{'=' * 80}")
    print(f"Total OCR Texts Extracted: {len(texts)}")
    print(f"{'=' * 80}\n")
    
    # Group by confidence
    high_conf = [t for t in texts if t['confidence'] > 80]
    med_conf = [t for t in texts if 50 <= t['confidence'] <= 80]
    low_conf = [t for t in texts if t['confidence'] < 50]
    
    print(f"Confidence Breakdown:")
    print(f"  High (>80%): {len(high_conf)}")
    print(f"  Medium (50-80%): {len(med_conf)}")
    print(f"  Low (<50%): {len(low_conf)}")
    
    # Look for expected patterns
    print(f"\n{'=' * 80}")
    print("Looking for Expected Patterns:")
    print(f"{'=' * 80}\n")
    
    # Transformers T1-T6
    transformers_found = [t for t in texts if t['text'] in ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']]
    print(f"Transformers (T1-T6): {len(transformers_found)} found")
    for t in transformers_found:
        print(f"  - {t['text']}: confidence={t['confidence']:.1f}%, bbox={t['bbox']}")
    
    # Bays
    bay_patterns = ['SRDN1', 'SRDN2', 'IOIM1', 'IOIM2', 'PJYC1', 'PJYC2']
    bays_found = [t for t in texts if t['text'] in bay_patterns]
    print(f"\nIncoming Bays: {len(bays_found)} found")
    for b in bays_found:
        print(f"  - {b['text']}: confidence={b['confidence']:.1f}%, bbox={b['bbox']}")
    
    # HV Breakers (110, 210, 310, 410, 510, 610)
    hv_breakers = ['110', '210', '310', '410', '510', '610']
    hv_found = [t for t in texts if t['text'] in hv_breakers]
    print(f"\nHV Breakers: {len(hv_found)} found")
    for h in hv_found:
        print(f"  - {h['text']}: confidence={h['confidence']:.1f}%, bbox={h['bbox']}")
    
    # Bay Breakers (305, 405, 505, 605, 705, 805)
    bay_breakers = ['305', '405', '505', '605', '705', '805']
    bay_br_found = [t for t in texts if t['text'] in bay_breakers]
    print(f"\nBay Breakers: {len(bay_br_found)} found")
    for b in bay_br_found:
        print(f"  - {b['text']}: confidence={b['confidence']:.1f}%, bbox={b['bbox']}")
    
    # MVA ratings
    mva_found = [t for t in texts if 'MVA' in t['text']]
    print(f"\nMVA Ratings: {len(mva_found)} found")
    for m in mva_found:
        print(f"  - {m['text']}: confidence={m['confidence']:.1f}%")
    
    # Voltage ratings
    kv_found = [t for t in texts if 'kV' in t['text'] or '/' in t['text']]
    print(f"\nVoltage Ratings: {len(kv_found)} found")
    for k in kv_found:
        print(f"  - {k['text']}: confidence={k['confidence']:.1f}%")
    
    # Color detection
    visuals = detect_colored_conductors(color_img)
    print(f"\n{'=' * 80}")
    print(f"Color Detection: {len(visuals)} conductors found")
    print(f"{'=' * 80}\n")
    
    voltage_counts = {}
    for v in visuals:
        vh = v['voltage_hint']
        voltage_counts[vh] = voltage_counts.get(vh, 0) + 1
    
    for voltage, count in sorted(voltage_counts.items()):
        print(f"  {voltage}kV: {count} conductors")
    
    # High-confidence text sample
    print(f"\n{'=' * 80}")
    print("High Confidence Texts (>80%, sample):")
    print(f"{'=' * 80}\n")
    
    for t in high_conf[:30]:
        print(f"  '{t['text']}' @ ({t['bbox']['x']}, {t['bbox']['y']}) conf={t['confidence']:.1f}%")
    
    # Export full data for analysis
    with open('/tmp/abba132_ocr_diagnostic.json', 'w') as f:
        json.dump({
            'texts': texts,
            'visuals': visuals,
            'summary': {
                'total_texts': len(texts),
                'high_confidence': len(high_conf),
                'transformers_found': [t['text'] for t in transformers_found],
                'bays_found': [b['text'] for b in bays_found],
                'hv_breakers_found': [h['text'] for h in hv_found],
                'bay_breakers_found': [b['text'] for b in bay_br_found]
            }
        }, f, indent=2)
    
    print(f"\n{'=' * 80}")
    print("Full diagnostic data saved to: /tmp/abba132_ocr_diagnostic.json")
    print(f"{'=' * 80}\n")

if __name__ == "__main__":
    diagnostic_ocr()
