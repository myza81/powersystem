import pdfplumber
import os
import django
import sys

# Setup django
sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation

sub = Substation.objects.get(substation_id='ABBA132')
print(f"Opening: {sub.sld_file.path}")

with pdfplumber.open(sub.sld_file.path) as pdf:
    page = pdf.pages[0]
    words = page.extract_words()
    print(f"Total words found: {len(words)}")
    for w in words[:50]:
        print(f"'{w['text']}' at {w['x0'], w['top']}")

    # Check for specific ones I expect
    targets = ['SRDN1', 'T1', '505', '110', '30']
    for t in targets:
        found = [w for w in words if t in w['text']]
        if found:
            print(f"FOUND {t}: {found[0]['x0'], found[0]['top']}")
        else:
            print(f"NOT FOUND: {t}")
