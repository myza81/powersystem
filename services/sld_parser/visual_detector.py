"""
Visual Feature Detector - Color-based Voltage Detection
Uses HSV color space to identify conductors and validate voltage levels.
"""

import cv2
import numpy as np
import typing
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

# HSV color ranges for Malaysian SLD standards
# Format: voltage_kv: (lower_hsv, upper_hsv)
COLOR_MAP = {
    132: ([40, 40, 40], [90, 255, 255]),    # Green
    33:  ([0, 120, 70], [10, 255, 255]),    # Red
    11:  ([20, 100, 100], [30, 255, 255]),  # Yellow/Orange
}


def detect_colored_conductors(image: np.ndarray) -> List[Dict]:
    """
    Detect colored conductor lines and infer voltage levels.
    
    Args:
        image: BGR color image (OpenCV format)
    
    Returns:
        List of detections with voltage hints and bounding boxes
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    detections = []
    
    for voltage, (low, high) in COLOR_MAP.items():
        mask = cv2.inRange(hsv, np.array(low), np.array(high))
        
        # Morphological operations to connect broken lines
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 100:  # Filter noise
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate confidence based on contour properties
            aspect_ratio = max(w, h) / min(w, h)
            confidence = min(0.9, 0.4 + (aspect_ratio / 20))  # Lines have high aspect ratio
            
            detections.append({
                "type": "conductor",
                "voltage_hint": int(voltage),
                "bbox": {"x": x, "y": y, "w": w, "h": h},
                "source": "color",
                "confidence": round(confidence, 2),
                "area": int(area)
            })
    
    logger.info(f"Detected {len(detections)} colored conductors")
    return detections


def detect_breaker_symbols(image: np.ndarray) -> List[Dict]:
    """
    Detect small square/rectangular breaker symbols from raster images.
    Returns bounding boxes in the same pixel coordinate space as OCR.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blurred, 50, 150)

    contours, _ = cv2.findContours(
        edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    detections = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 80:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        if w < 8 or h < 8:
            continue
        if w > 300 or h > 300:
            continue
        rect_area = float(w * h)
        fill_ratio = area / rect_area if rect_area > 0 else 0
        if fill_ratio < 0.45:
            continue
        aspect = max(w, h) / max(1, min(w, h))
        if aspect > 4.0:
            continue

        approx = cv2.approxPolyDP(contour, 0.03 * cv2.arcLength(contour, True), True)
        if len(approx) < 4:
            continue

        detections.append({
            "type": "breaker_symbol",
            "bbox": {"x": x, "y": y, "w": w, "h": h},
            "source": "shape",
            "confidence": 0.6
        })

    logger.info(f"Detected {len(detections)} breaker symbols")
    return detections


def validate_voltage_by_color(bbox: Dict, color_detections: List[Dict], tolerance: int = 30) -> typing.Optional[int]:
    """
    Validate/infer voltage level based on nearby conductor colors.
    
    Args:
        bbox: Bounding box {'x', 'y', 'w', 'h'} of equipment
        color_detections: List from detect_colored_conductors
        tolerance: Pixel distance tolerance for "nearby"
    
    Returns:
        Inferred voltage in kV, or None if ambiguous
    """
    candidates = []
    
    for det in color_detections:
        # Check if conductor bbox overlaps or is near the equipment bbox
        dx = abs((det["bbox"]["x"] + det["bbox"]["w"]/2) - (bbox["x"] + bbox["w"]/2))
        dy = abs((det["bbox"]["y"] + det["bbox"]["h"]/2) - (bbox["y"] + bbox["h"]/2))
        
        if dx < tolerance or dy < tolerance:
            candidates.append(det["voltage_hint"])
    
    if not candidates:
        return None
    
    # Return most common voltage if consensus, else None
    from collections import Counter
    counts = Counter(candidates)
    most_common = counts.most_common(1)[0]
    
    if most_common[1] >= len(candidates) * 0.6:  # 60% consensus
        return most_common[0]
    
    return None
