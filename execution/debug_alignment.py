"""Quick debug script to see why transformers aren't being matched"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from services.sld_parser.image_utils import pdf_to_images, preprocess_image
from services.sld_parser.ocr_extractor import extract_text_with_boxes
from core.models import Substation

sub = Substation.objects.get(substation_id='ABBA132')
images = pdf_to_images(sub.sld_file.path)
color_img, binary_img = preprocess_image(images[0])
texts = extract_text_with_boxes(binary_img)

# Find all T4 and 410 instances
t4s = [t for t in texts if t['text'] == 'T4']
b410s = [t for t in texts if t['text'] == '410']

print(f"T4 instances: {len(t4s)}")
for t in t4s:
    print(f"  T4 @ x={t['bbox']['x']+t['bbox']['w']/2:.0f}, y={t['bbox']['y']}, conf={t['confidence']}")

print(f"\n410 instances: {len(b410s)}")
for b in b410s:
    print(f"  410 @ x={b['bbox']['x']+b['bbox']['w']/2:.0f}, y={b['bbox']['y']}, conf={b['confidence']}")

# Check distances
print("\nHorizontal distances between T4 and 410:")
for t in t4s:
    tx = t['bbox']['x'] + t['bbox']['w'] / 2
    for b in b410s:
        bx = b['bbox']['x'] + b['bbox']['w'] / 2
        dist = abs(tx - bx)
        print(f"  T4({tx:.0f}) to 410({bx:.0f}): {dist:.0f}px")
