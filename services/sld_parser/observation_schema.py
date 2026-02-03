"""
Observation Schema - Raw Data Structure
Defines the format for observations before LLM/fallback processing.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any
import json


@dataclass
class BoundingBox:
    x: int
    y: int
    w: int
    h: int


@dataclass
class TextObservation:
    text: str
    bbox: Dict[str, int]
    confidence: float


@dataclass
class VisualObservation:
    type: str  # "conductor", "symbol", etc.
    voltage_hint: int = None
    bbox: Dict[str, int] = None
    confidence: float = 0.0
    source: str = "color"  # "color", "shape", "pattern"


@dataclass
class SLDObservations:
    """Complete set of raw observations from a single SLD page."""
    texts: List[Dict[str, Any]]
    visual_elements: List[Dict[str, Any]]
    page_width: int = None
    page_height: int = None
    
    def to_dict(self) -> Dict:
        """Convert to JSON-serializable dict."""
        return {
            "texts": self.texts,
            "visual_elements": self.visual_elements,
            "page_dimensions": {
                "width": self.page_width,
                "height": self.page_height
            } if self.page_width else None
        }
    
    def to_json(self, indent: int = 2) -> str:
        """Export as formatted JSON string."""
        return json.dumps(self.to_dict(), indent=indent)


def build_observations(
    texts: List[Dict],
    visuals: List[Dict],
    page_dims: tuple = None
) -> SLDObservations:
    """
    Assemble observations from OCR and visual detection results.
    
    Args:
        texts: Output from ocr_extractor.extract_text_with_boxes
        visuals: Output from visual_detector.detect_colored_conductors
        page_dims: Optional (width, height) tuple
    
    Returns:
        SLDObservations object ready for reasoning layer
    """
    pw, ph = page_dims if page_dims else (None, None)
    
    return SLDObservations(
        texts=texts,
        visual_elements=visuals,
        page_width=pw,
        page_height=ph
    )
