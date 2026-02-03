"""
SLD Pipeline Orchestrator
Main entry point for SLD parsing with LLM/fallback routing.
"""

from typing import Dict, Optional, Any, cast
import logging
import os

from .image_utils import pdf_to_images, preprocess_image
from .ocr_extractor import extract_text_with_boxes
from .visual_detector import detect_colored_conductors, detect_breaker_symbols
from .observation_schema import build_observations
from .llm import LLMProviderFactory
from .fallback_parser import parse_fallback
from .validator import validate_dataset, ValidationError

logger = logging.getLogger(__name__)

# Load system prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "sld_instruction12.txt")
with open(PROMPT_PATH, 'r') as f:
    SYSTEM_PROMPT = f.read()


class SLDPipeline:
    """Main SLD parsing pipeline with OCR + LLM/Fallback."""
    
    @staticmethod
    def parse(
        pdf_path: str,
        use_llm: bool = True,
        llm_provider: str = "auto",
        validate: bool = True
    ) -> Dict:
        """
        Parse SLD (PDF, DXF, or Image) into structured equipment data.
        """
        from .dxf_parser import DXFParser
        from .svg_parser import SVGParser
        from .ocr_extractor import extract_native_text
        
        logger.info(f"Starting SLD pipeline for {pdf_path}")
        logger.info(f"Mode: {'LLM' if use_llm else 'Fallback'}, Provider: {llm_provider}")
        
        try:
            observations = None
            
            # 1. Try DXF (Native Vector - 100% Accuracy)
            if DXFParser.is_dxf(pdf_path):
                logger.info("Detected DXF file, using native vector parser")
                observations_dict = DXFParser.extract_observations(pdf_path)
                
                # FALLBACK check: If DXF has no text, it might just be geometric polylines
                # We should fall back to OCR if we find nothing
                if observations_dict.get("texts"):
                    from .observation_schema import SLDObservations
                    observations = SLDObservations(
                        texts=observations_dict["texts"],
                        visual_elements=observations_dict["visual_elements"]
                    )
                else:
                    raise Exception(
                        "This DXF file is 'geometric-only' and lacks searchable text metadata. "
                        "Please provide a proper engineering DXF with text attributes, or upload a PDF version as an alternative. "
                        "Note: PDF extraction may be slightly less accurate for breaker mapping."
                    )
            
            # 2. Try SVG (Native Vector - 100% Accuracy)
            elif pdf_path.lower().endswith('.svg'):
                logger.info("Detected SVG file, using native vector parser")
                observations_raw = SVGParser.extract_observations(pdf_path)
                if hasattr(observations_raw, "to_dict"):
                    observations_dict = cast(Dict[str, Any], observations_raw.to_dict())
                else:
                    observations_dict = cast(Dict[str, Any], observations_raw)
                
                if observations_dict.get("texts"):
                    from .observation_schema import SLDObservations
                    observations = SLDObservations(
                        texts=observations_dict["texts"],
                        visual_elements=observations_dict["visual_elements"]
                    )
                else:
                    raise Exception(
                        "This SVG file lacks searchable text labels. "
                        "Please provide an SVG with text elements, or upload a PDF version as an alternative. "
                        "Note: PDF extraction may be slightly less accurate for breaker mapping."
                    )
            
            # 3. Try Searchable PDF (Native Text Layer - 98% Accuracy)
            if not observations and pdf_path.lower().endswith('.pdf'):
                logger.info("Checking for native text layer in PDF")
                native_texts = extract_native_text(pdf_path)
                
                if native_texts and len(native_texts) > 20:
                    logger.info("Found native text layer, bypassing OCR")
                    # Still need color detection for voltage (rasterizing for vision)
                    images = pdf_to_images(pdf_path)
                    color_img, _ = preprocess_image(images[0])
                    visuals = detect_colored_conductors(color_img)
                    visuals.extend(detect_breaker_symbols(color_img))
                    
                    observations = build_observations(native_texts, visuals)
                else:
                    logger.info("No substantial text layer found, falling back to OCR")
            
            # 3. Traditional Raster + OCR Pipeline
            if not observations:
                # Check if we can actually rasterize/OCR this file type
                supported_raster = ('.pdf', '.png', '.jpg', '.jpeg')
                if not any(pdf_path.lower().endswith(ext) for ext in supported_raster):
                    raise Exception(
                        f"Primary extraction failed and file type '{os.path.splitext(pdf_path)[1]}' "
                        "does not support OCR fallback. Please provide a PDF or high-quality DXF with text metadata. "
                        "Note: If you use PDF, the extraction might be slightly less accurate than a proper DXF."
                    )

                # Convert PDF/Image to images
                if pdf_path.lower().endswith('.pdf'):
                    images = pdf_to_images(pdf_path)
                    page = images[0] if images else None
                else:
                    from PIL import Image
                    page = Image.open(pdf_path)
                
                if not page:
                    raise Exception("No image data found to process")
                
                color_img, binary_img = preprocess_image(page)
                
                # OCR extraction
                texts = extract_text_with_boxes(binary_img)
                logger.info(f"Extracted {len(texts)} text elements via OCR")
                
                # Color-based voltage detection
                visuals = detect_colored_conductors(color_img)
                visuals.extend(detect_breaker_symbols(color_img))
                logger.info(f"Detected {len(visuals)} colored conductors")
                
                # Build observations
                observations = build_observations(texts, visuals)
            
            # Step 3: Reasoning layer (LLM or Fallback)
            if use_llm:
                parsed = SLDPipeline._parse_with_llm(
                    observations.to_dict(),
                    llm_provider
                )
            else:
                parsed = parse_fallback(observations.to_dict())
            
            # Step 4: Validation
            if validate:
                parsed = validate_dataset(parsed)
            
            logger.info(
                f"Pipeline complete: {len(parsed.get('transformers', []))} transformers, "
                f"{len(parsed.get('incoming_bays', []))} bays"
            )
            
            # Add parsing metadata
            if DXFParser.is_dxf(pdf_path):
                parsed["_source"] = "dxf"
            elif pdf_path.lower().endswith('.svg'):
                parsed["_source"] = "svg"
            elif "native" in locals() and locals().get("native_texts"):
                parsed["_source"] = "native_pdf"
            else:
                parsed["_source"] = "raster_ocr"
            
            return parsed
            
        except ValidationError:
            raise  # Re-raise validation errors
        except Exception as e:
            logger.error(f"Pipeline failed: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def _parse_with_llm(observations: Dict, provider_name: str) -> Dict:
        """
        Parse using LLM provider.
        
        Args:
            observations: Raw observations dict
            provider_name: Provider to use ('auto' for auto-select)
        
        Returns:
            Parsed structured data
        """
        # Determine providers to try
        providers_to_try = []
        
        if provider_name != "auto":
            # User requested specific provider
            try:
                providers_to_try.append(LLMProviderFactory.create(provider_name))
            except Exception as e:
                logger.warning(f"Requested provider {provider_name} not available: {e}")
        else:
            # Auto-select: Try OpenAI then Gemini
            available = LLMProviderFactory.get_available_providers() # Returns names
            
            # Priority 1: OpenAI
            if "openai" in available:
                try:
                    providers_to_try.append(LLMProviderFactory.create("openai"))
                except: pass
            
            # Priority 2: Gemini
            if "gemini" in available:
                try:
                    providers_to_try.append(LLMProviderFactory.create("gemini"))
                except: pass
                
            # Others
            for name in available:
                if name not in ["openai", "gemini"]:
                    try:
                        providers_to_try.append(LLMProviderFactory.create(name))
                    except: pass
        
        if not providers_to_try:
             logger.warning("No LLM providers available, falling back to rules")
             return parse_fallback(observations)

        # Try each provider in order
        last_error = None
        for provider in providers_to_try:
            try:
                logger.info(f"Attempting parse with provider: {provider.get_provider_name()}")
                result = provider.parse_observations(
                    observations,
                    SYSTEM_PROMPT,
                    temperature=0.0
                )
                return result
            except Exception as e:
                logger.error(f"Provider {provider.get_provider_name()} failed: {str(e)}")
                last_error = e
                continue # Try next provider
        
        logger.error(f"All LLM providers failed. Last error: {str(last_error)}")
        logger.warning("Falling back to rule-based parser")
        return parse_fallback(observations)
    
    @staticmethod
    def get_available_providers() -> list:
        """Get list of available LLM providers."""
        return LLMProviderFactory.get_available_providers()
