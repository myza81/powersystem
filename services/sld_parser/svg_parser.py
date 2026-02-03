"""
SVG Parser for browser-compatible SLD extraction.
Extracts text and geometric path data from SVG XML structure.
"""

import logging
import os
import re
from xml.etree import ElementTree as ET
from typing import Dict, List, Any, Optional
from .observation_schema import SLDObservations

logger = logging.getLogger(__name__)

class SVGParser:
    """Parser for SVG files to extract electrical equipment observations."""
    
    @classmethod
    def extract_observations(cls, svg_path: str) -> SLDObservations:
        """
        Extract text and visual entities from an SVG file.
        
        Args:
            svg_path: Absolute path to the SVG file
            
        Returns:
            SLDObservations containing extracted data
        """
        try:
            # Parse XML
            tree = ET.parse(svg_path)
            root = tree.getroot()
            
            # SVG namespaces
            ns = {'svg': 'http://www.w3.org/2000/svg'}
            
            texts = []
            visual_elements = []
            
            # 1. Extract Text elements
            # Look for all text elements (including nested tspans)
            for text_elem in root.iter('{http://www.w3.org/2000/svg}text'):
                text_content = "".join(text_elem.itertext()).strip()
                if not text_content:
                    continue
                
                # Get coordinates (SVG uses top-left origin)
                x = float(text_elem.get('x', 0))
                y = float(text_elem.get('y', 0))
                
                texts.append({
                    "text": text_content,
                    "confidence": 100.0,
                    "bbox": {
                        "x": x,
                        "y": y,
                        "w": 50, # Estimated
                        "h": 20  # Estimated
                    },
                    "source": "svg"
                })
            
            # 2. Extract Geometric elements for voltage hints (based on stroke color)
            # Voltages: 132=Green, 33=Red, 11=Yellow
            color_map = {
                '#00FF00': 132, # Green
                '#FF0000': 33,  # Red
                '#FFFF00': 11,  # Yellow
                '#00FFFF': 275, # Cyan
                '#000000': 500  # Black
            }
            
            for path_elem in root.iter('{http://www.w3.org/2000/svg}path'):
                stroke = path_elem.get('stroke', '').upper()
                if stroke in color_map:
                    # For paths, we'd ideally parse the 'd' attribute 
                    # for bbox, but we can use simple placeholder for now
                    visual_elements.append({
                        "type": "conductor",
                        "voltage_hint": color_map[stroke],
                        "bbox": {"x": 0, "y": 0, "w": 0, "h": 0} # Placeholder
                    })
            
            return {
                "texts": texts,
                "visual_elements": visual_elements,
                "metadata": {
                    "source": "svg",
                    "file": os.path.basename(svg_path)
                }
            }
            
        except Exception as e:
            logger.error(f"SVG parsing failed: {str(e)}")
            raise

    @classmethod
    def is_svg(cls, file_path: str) -> bool:
        """Check if file is an SVG based on extension."""
        return file_path.lower().endswith('.svg')
