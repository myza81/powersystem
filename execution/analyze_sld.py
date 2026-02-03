import sys
try:
    import pdfplumber
except ImportError:
    print("pdfplumber not found")
    sys.exit(1)

path = "media/slds/ABBA132.pdf"
with pdfplumber.open(path) as pdf:
    page = pdf.pages[0]
    text = page.extract_text()
    print("--- Extracted Text ---")
    print(text)
    print("\n--- Word Positions (First 10) ---")
    words = page.extract_words()
    for word in words[:10]:
        print(word)
