"""
Image Utilities for SLD Processing
Handles PDF-to-image conversion and preprocessing for OCR.
"""

from pdf2image import convert_from_path
import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


def pdf_to_images(pdf_path: str, dpi: int = 600) -> List[Image.Image]:
    """
    Convert PDF to list of PIL images.
    
    Args:
        pdf_path: Absolute path to PDF file
        dpi: Resolution for conversion (300 is optimal balance for OCR)
    
    Returns:
        List of PIL Image objects, one per page
    """
    try:
        images = convert_from_path(pdf_path, dpi=dpi)
        logger.info(f"Converted {len(images)} pages from {pdf_path} at {dpi} DPI")
        return images
    except Exception as e:
        logger.error(f"PDF conversion failed: {str(e)}")
        raise


def preprocess_image(pil_img: Image.Image) -> Tuple[np.ndarray, np.ndarray]:
    """
    Preprocess image for OCR and color detection.
    
    Args:
        pil_img: PIL Image object
    
    Returns:
        Tuple of (color_image, grayscale_binary)
        - color_image: BGR format for color detection
        - grayscale_binary: Binary image optimized for OCR
    """
    # Convert to OpenCV format
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    
    # Grayscale conversion for OCR
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adaptive thresholding for better OCR results (no sharpening - causes issues)
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 2
    )
    
    return img, binary


def enhance_for_ocr(image: np.ndarray) -> np.ndarray:
    """
    Apply additional enhancements for difficult-to-read text.
    
    Args:
        image: Grayscale image
    
    Returns:
        Enhanced grayscale image
    """
    # Noise reduction
    denoised = cv2.fastNlMeansDenoising(image)
    
    # Contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    
    return enhanced
