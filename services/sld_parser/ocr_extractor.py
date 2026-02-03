"""
OCR Extractor with Bounding Box Support
Uses Tesseract OCR to extract text with spatial coordinates.
"""

import pytesseract
import numpy as np
from typing import List, Dict
import logging
import pdfplumber

logger = logging.getLogger(__name__)


def extract_native_text(pdf_path: str) -> List[Dict]:
    """
    Extract native text objects from a Searchable PDF.
    Bypasses OCR for 100% text accuracy on digital PDFs.
    """
    try:
        results = []
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return []
            
            page = pdf.pages[0]
            words = page.extract_words()
            
            for word in words:
                results.append({
                    "text": word['text'],
                    "confidence": 100.0,
                    "bbox": {
                        "x": float(word['x0']),
                        "y": float(word['top']),
                        "w": float(word['x1'] - word['x0']),
                        "h": float(word['bottom'] - word['top'])
                    }
                })
        
        logger.info(f"Extracted {len(results)} native text elements from PDF")
        return results
    except Exception as e:
        logger.warning(f"Native PDF extraction skipped: {str(e)}")
        return []


def extract_text_with_boxes(image: np.ndarray) -> List[Dict]:
    """
    Extract text from image with bounding box coordinates.
    
    Args:
        image: Grayscale or binary image (numpy array)
    
    Returns:
        List of dictionaries with:
        - text: Extracted text string
        - bbox: {x, y, w, h} bounding box
        - confidence: Tesseract confidence score (0-100)
    """
    try:
        data = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT,
            config="--psm 6"  # Assume uniform text block
        )
        
        texts = []
        for i, txt in enumerate(data["text"]):
            if txt.strip() and data["conf"][i] > 30:  # Filter low-confidence
                texts.append({
                    "text": txt.strip(),
                    "bbox": {
                        "x": data["left"][i],
                        "y": data["top"][i],
                        "w": data["width"][i],
                        "h": data["height"][i],
                    },
                    "confidence": float(data["conf"][i])
                })
        
        logger.info(f"Extracted {len(texts)} text elements")
        return texts
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {str(e)}")
        return []


def get_text_in_region(texts: List[Dict], x: int, y: int, radius: int = 50) -> List[Dict]:
    """
    Find all text elements near a specific coordinate.
    
    Args:
        texts: List of text dictionaries from extract_text_with_boxes
        x, y: Center coordinates
        radius: Search radius in pixels
    
    Returns:
        List of text elements within radius, sorted by distance
    """
    nearby = []
    for t in texts:
        center_x = t["bbox"]["x"] + t["bbox"]["w"] / 2
        center_y = t["bbox"]["y"] + t["bbox"]["h"] / 2
        dist = ((center_x - x)**2 + (center_y - y)**2) ** 0.5
        
        if dist <= radius:
            nearby.append({**t, "distance": dist})
    
    return sorted(nearby, key=lambda x: x["distance"])
