"""
DXF Parser for native AutoCAD SLD extraction.
Bypasses OCR by reading text and geometry directly from DXF entities.
"""

import ezdxf
import logging
import re
import math
import os
from typing import Dict, List, Any, Optional, cast

logger = logging.getLogger(__name__)

class DXFParser:
    """Parser for DXF files to extract electrical equipment observations."""
    
    @classmethod
    def extract_observations(cls, dxf_path: str) -> Dict[str, Any]:
        """
        Extract text and visual entities from a DXF file.
        
        Args:
            dxf_path: Absolute path to the DXF file
            
        Returns:
            Parsed observations dict
        """
        try:
            readfile = getattr(ezdxf, "readfile", None)
            if readfile is None:
                raise ImportError("ezdxf.readfile is unavailable")
            doc = readfile(dxf_path)
            msp = doc.modelspace()
            
            # Detect units for scaling
            # 1 = Inches, 4 = Millimeters, 6 = Meters
            units = doc.header.get('$INSUNITS', 0)
            if units == 1: # Inches
                SCALE = 300.0
            elif units == 4: # MM
                SCALE = 11.8 # 300 DPI / 25.4
            elif units == 6: # Meters
                SCALE = 300.0 / 0.0254
            else:
                # Unitless: try extents-based normalization
                extmin = doc.header.get('$EXTMIN')
                extmax = doc.header.get('$EXTMAX')
                if extmin and extmax:
                    width_units = abs(extmax[0] - extmin[0])
                    if width_units > 0:
                        SCALE = 5000.0 / width_units
                    else:
                        SCALE = 300.0
                else:
                    SCALE = 300.0 # Default fallback
            
            logger.info(f"DXF units detected: {units}, using scale: {SCALE}")
            
            texts = []
            visual_elements = []
            
            def normalize_text(text: str) -> str:
                return re.sub(r"\s+", " ", text.strip())

            def rotated_bbox(cx: float, cy: float, w: float, h: float, angle_deg: float) -> Dict[str, float]:
                if not angle_deg:
                    return {"x": cx - w / 2, "y": cy - h / 2, "w": w, "h": h}
                angle = math.radians(angle_deg)
                cos_a = abs(math.cos(angle))
                sin_a = abs(math.sin(angle))
                bw = w * cos_a + h * sin_a
                bh = w * sin_a + h * cos_a
                return {"x": cx - bw / 2, "y": cy - bh / 2, "w": bw, "h": bh}

            # 1. Extract Text Entities (TEXT, MTEXT)
            for entity in msp.query('TEXT MTEXT'):
                entity_any: Any = entity
                # Extract text content (strip formatting for MTEXT)
                if entity_any.dxftype() == 'MTEXT':
                    plain_text = getattr(entity_any, "plain_text", None)
                    text_content = plain_text() if callable(plain_text) else str(entity)
                    text_height = getattr(entity_any.dxf, "char_height", None) or getattr(entity_any.dxf, "height", None) or 2.5
                    rotation = getattr(entity_any.dxf, "rotation", 0.0)
                else:
                    text_content = entity_any.dxf.text
                    text_height = getattr(entity_any.dxf, "height", None) or 2.5
                    rotation = getattr(entity_any.dxf, "rotation", 0.0)
                
                # Get coordinates and scale them
                insert = entity_any.dxf.insert
                cx = insert.x * SCALE
                cy = -insert.y * SCALE  # Flip Y to match image coordinates (top-left origin)
                text_content_str = str(text_content)
                text_content = normalize_text(text_content_str)
                # Estimate bbox from text length and height
                est_w = max(10.0, len(text_content) * text_height * 0.6) * SCALE
                est_h = max(8.0, text_height) * SCALE
                bbox = rotated_bbox(cx, cy, est_w, est_h, rotation)
                
                texts.append({
                    "text": text_content,
                    "confidence": 100.0,
                    "bbox": bbox,
                    "layer": entity_any.dxf.layer,
                    "rotation": rotation
                })
            
            # Pre-define color to voltage mapping (Malaysian Standards via SLD Instruction #12)
            COLOR_MAP = {
                1: 33,   # Red -> 33kV
                2: 11,   # Yellow/Orange -> 11kV
                3: 132,  # Green -> 132kV
                4: 132,  # Cyan -> 132kV (Common variant)
                5: 275,  # Blue -> 275kV
                6: 500,  # Magenta -> 500kV
            }

            # Cache layer metadata for faster voltage inference
            layer_voltage_hint = {}
            layer_color_hint = {}
            for layer in doc.layers:
                lname = layer.dxf.name.upper()
                if '500' in lname:
                    layer_voltage_hint[lname] = 500
                elif '275' in lname:
                    layer_voltage_hint[lname] = 275
                elif '132' in lname:
                    layer_voltage_hint[lname] = 132
                elif '33' in lname:
                    layer_voltage_hint[lname] = 33
                elif '11' in lname:
                    layer_voltage_hint[lname] = 11
                layer_color_hint[lname] = {
                    "aci": getattr(layer.dxf, "color", 7),
                    "true_color": getattr(layer.dxf, "true_color", None)
                }

            def _true_color_to_voltage(true_color: Optional[int]) -> Optional[int]:
                if true_color is None:
                    return None
                r = (true_color >> 16) & 0xFF
                g = (true_color >> 8) & 0xFF
                b = true_color & 0xFF
                # Rough mapping to known SLD colors
                if r > 200 and g < 80 and b < 80:
                    return 33
                if r > 180 and g > 120 and b < 60:
                    return 11
                if g > 120 and r < 120 and b < 120:
                    return 132
                if b > 120 and r < 120 and g < 160:
                    return 275
                if r > 160 and b > 160:
                    return 500
                return None

            def get_voltage_hint(e):
                layer = e.dxf.layer.upper()
                # 1. Try layer name first (Explicit naming is high priority)
                if layer in layer_voltage_hint:
                    return layer_voltage_hint[layer]

                # 2. Try True Color (entity-level)
                true_color = getattr(e.dxf, 'true_color', None)
                v_true = _true_color_to_voltage(true_color)
                if v_true:
                    return v_true
                
                # 3. Try Color (AutoCAD Color Index)
                color = getattr(e.dxf, 'color', 256)
                if color == 256: # ByLayer
                    layer_meta = layer_color_hint.get(layer)
                    if layer_meta:
                        v_layer_true = _true_color_to_voltage(layer_meta.get("true_color"))
                        if v_layer_true:
                            return v_layer_true
                        color = layer_meta.get("aci", 7)
                    else:
                        color = 7
                return COLOR_MAP.get(color)

            # 2. Extract Geometry (Symbols and Conductors)

            # --- CIRCLES (Windings/Transformers) ---
            for entity in msp.query('CIRCLE'):
                v_hint = get_voltage_hint(entity)
                r = entity.dxf.radius * SCALE
                cx = entity.dxf.center.x * SCALE
                cy = -entity.dxf.center.y * SCALE
                visual_elements.append({
                    "type": "winding",
                    "voltage_hint": v_hint,
                    "layer": entity.dxf.layer,
                    "bbox": {"x": cx - r, "y": cy - r, "w": 2*r, "h": 2*r}
                })

            # --- LINEs (Conductors) ---
            for entity in msp.query('LINE'):
                v_hint = get_voltage_hint(entity)
                start, end = entity.dxf.start, entity.dxf.end
                min_x, max_x = min(start.x, end.x), max(start.x, end.x)
                min_y, max_y = min(start.y, end.y), max(start.y, end.y)
                visual_elements.append({
                    "type": "conductor",
                    "voltage_hint": v_hint,
                    "layer": entity.dxf.layer,
                    "bbox": {
                        "x": min_x * SCALE,
                        "y": -max_y * SCALE, # Inverted Y top
                        "w": (max_x - min_x) * SCALE,
                        "h": (max_y - min_y) * SCALE
                    }
                })

            # --- POLYLINEs + LWPOLYLINEs (Breakers or Busbars/Conductors) ---
            for entity in msp.query('LWPOLYLINE POLYLINE'):
                entity_any: Any = entity
                v_hint = get_voltage_hint(entity_any)
                if entity_any.dxftype() == 'LWPOLYLINE':
                    get_points = getattr(entity_any, "get_points", None)
                    points_any: Any = get_points() if callable(get_points) else []
                    points = list(cast(Any, points_any)) if points_any is not None else []
                    x_pts = [p[0] for p in points]
                    y_pts = [p[1] for p in points]
                else:
                    vertices = getattr(entity_any, "vertices", None)
                    points_any: Any = vertices() if callable(vertices) else []
                    points = list(cast(Any, points_any)) if points_any is not None else []
                    if not points:
                        continue
                    x_pts = [p.dxf.location.x for p in points]
                    y_pts = [p.dxf.location.y for p in points]
                if not x_pts or not y_pts:
                    continue
                min_x, max_x = min(x_pts), max(x_pts)
                min_y, max_y = min(y_pts), max(y_pts)
                w, h = (max_x - min_x) * SCALE, (max_y - min_y) * SCALE
                aspect = (max(w, h) / max(1.0, min(w, h)))
                
                etype = "conductor"
                # Small, square/rectangular shapes are likely breaker symbols
                if len(x_pts) >= 4 and w < 160 and h < 160 and aspect < 4.0:
                    etype = "breaker_symbol"
                elif aspect > 6:
                    etype = "conductor"
                
                if etype == "conductor" and not v_hint:
                    continue # Skip uncolored conductors
                
                visual_elements.append({
                    "type": etype,
                    "voltage_hint": v_hint,
                    "layer": entity_any.dxf.layer,
                    "bbox": {
                        "x": min_x * SCALE,
                        "y": -max_y * SCALE,
                        "w": w,
                        "h": h
                    }
                })
            
            logger.info(f"DXF Extraction complete: {len(texts)} texts, {len(visual_elements)} visual hints")
            
            return {
                "texts": texts,
                "visual_elements": visual_elements,
                "metadata": {
                    "source": "dxf",
                    "file": os.path.basename(dxf_path),
                    "units": units,
                    "scale": SCALE,
                    "extents": {
                        "min": list(doc.header.get('$EXTMIN') or []),
                        "max": list(doc.header.get('$EXTMAX') or [])
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"DXF parsing failed: {str(e)}")
            raise

    @classmethod
    def is_dxf(cls, file_path: str) -> bool:
        """Check if file is a DXF based on extension."""
        return file_path.lower().endswith('.dxf')
