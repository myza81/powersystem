## Overall Architecture 
PDF / Image SLD
   ↓
Image Normalisation
   ↓
OCR + Visual Feature Extraction
   ↓
Structured Observations (raw, uncertain)
   ↓
LLM (Instruction No.12 prompt)
   ↓
Validated JSON (Django-ready)
   ↓
DB Ingestion (soft-update, is_active)

## Folder Structure
sld_parser/
├── pipeline.py              # Orchestrator
├── image_utils.py           # PDF → image, preprocessing
├── ocr.py                   # Text extraction
├── vision.py                # Color & shape detection
├── observation_schema.py    # Raw observation structure
├── llm_client.py            # LLM call
├── validator.py             # Instruction No.12 checks
├── ingest.py                # Django ingestion
└── prompts/
    └── sld_parser_prompt.txt

## Image & PDF Handling
from pdf2image import convert_from_path
import cv2
import numpy as np

def pdf_to_images(pdf_path, dpi=300):
    return convert_from_path(pdf_path, dpi=dpi)

def preprocess_image(pil_img):
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 2
    )
    return img, gray

## OCR (text + bounding boxes)
import pytesseract

def extract_text(img):
    data = pytesseract.image_to_data(
        img,
        output_type=pytesseract.Output.DICT,
        config="--psm 6"
    )

    texts = []
    for i, txt in enumerate(data["text"]):
        if txt.strip():
            texts.append({
                "text": txt.strip(),
                "bbox": {
                    "x": data["left"][i],
                    "y": data["top"][i],
                    "w": data["width"][i],
                    "h": data["height"][i],
                }
            })
    return texts

## Color & Symbol Detection
import cv2
import numpy as np

COLOR_MAP = {
    "132": ([40, 40, 40], [90, 255, 255]),   # green
    "33":  ([0, 120, 70], [10, 255, 255]),  # red
    "11":  ([20, 100, 100], [30, 255, 255]) # yellow
}

def detect_colored_lines(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    detections = []

    for voltage, (low, high) in COLOR_MAP.items():
        mask = cv2.inRange(hsv, np.array(low), np.array(high))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            x,y,w,h = cv2.boundingRect(c)
            detections.append({
                "type": "conductor",
                "voltage_hint": int(voltage),
                "bbox": {"x":x,"y":y,"w":w,"h":h},
                "source": "color",
                "confidence": 0.6
            })
    return detections

## Observation Assembly
def build_observations(texts, visuals):
    return {
        "texts": texts,
        "visual_elements": visuals
    }

## LLM Call (Instruction No.12 prompt)
import json
from openai import OpenAI

client = OpenAI()

def parse_with_llm(observations, prompt_text):
    response = client.chat.completions.create(
        model="gpt-4.1",
        temperature=0,
        messages=[
            {"role": "system", "content": prompt_text},
            {"role": "user", "content": json.dumps(observations, indent=2)}
        ]
    )
    return json.loads(response.choices[0].message.content)

## Validation (Instruction No.12 safety net)
import re

def validate_transformer(t):
    assert re.match(r'^(T|SGT|XGT|GT|ST|ET)\d+[A-Z]?$', t["transformer_id"])
    assert t["hv_voltage"] in [132, 275, 500]
    if "hv_breaker_number" in t:
        assert re.match(r'^\d{3}$', t["hv_breaker_number"])

def validate_dataset(data):
    for t in data.get("transformers", []):
        validate_transformer(t)

## Django Ingestion
from grid.models import Substation, Transformer, IncomingBay
from django.db import transaction

@transaction.atomic
def ingest_substation(parsed):
    sub = Substation.objects.get(substation_id=parsed["substation"]["substation_id"])

    # Deactivate existing equipment
    Transformer.objects.filter(substation=sub, is_active=True).update(is_active=False)
    IncomingBay.objects.filter(substation=sub, is_active=True).update(is_active=False)

    for t in parsed.get("transformers", []):
        Transformer.objects.create(
            substation=sub,
            transformer_id=t["transformer_id"],
            sequence_number=t["sequence_number"],
            hv_voltage=t["hv_voltage"],
            lv_voltage=t["lv_voltage"],
            hv_breaker_number=t.get("hv_breaker_number"),
            lv_breaker_number=t.get("lv_breaker_number"),
            is_active=True
        )

    for b in parsed.get("incoming_bays", []):
        IncomingBay.objects.create(
            substation=sub,
            bay_id=b["bay_id"],
            voltage=b["voltage"],
            breaker_number=b["breaker_number"],
            sequence_number=b["sequence_number"],
            is_active=True
        )

## Orchestrator
from image_utils import pdf_to_images, preprocess_image
from ocr import extract_text
from vision import detect_colored_lines
from observation_schema import build_observations
from llm_client import parse_with_llm
from validator import validate_dataset
from ingest import ingest_substation

def parse_sld(pdf_path, prompt_text):
    images = pdf_to_images(pdf_path)
    all_texts, all_visuals = [], []

    for img in images:
        color_img, gray = preprocess_image(img)
        all_texts.extend(extract_text(gray))
        all_visuals.extend(detect_colored_lines(color_img))

    observations = build_observations(all_texts, all_visuals)
    parsed = parse_with_llm(observations, prompt_text)
    validate_dataset(parsed)
    ingest_substation(parsed)
