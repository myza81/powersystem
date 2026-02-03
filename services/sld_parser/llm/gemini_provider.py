"""
Google Gemini Provider Implementation
"""

from . import LLMProvider
from typing import Dict, Any
import json
import os
import logging

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    """Google Gemini provider."""
    
    def __init__(self, api_key: str = None, model: str = "gemini-2.0-flash", **kwargs):
        super().__init__(api_key, **kwargs)
        self.model = model
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self._client = None
    
    def _get_client(self):
        """Lazy-load Gemini client."""
        if self._client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._client = genai.GenerativeModel(self.model)
            except ImportError:
                raise ImportError("google-generativeai not installed. Run: pip install google-generativeai")
        return self._client
    
    def parse_observations(
        self,
        observations: Dict[str, Any],
        prompt: str,
        temperature: float = 0.0
    ) -> Dict[str, Any]:
        """Parse observations using Gemini."""
        model = self._get_client()
        
        try:
            full_prompt = f"{prompt}\n\nObservations:\n{json.dumps(observations, indent=2)}"
            
            response = model.generate_content(
                full_prompt,
                generation_config={"temperature": temperature}
            )
            
            content = response.text
            # Extract JSON from markdown code blocks if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            
            logger.info(f"Gemini parsing complete: {len(result.get('transformers', []))} transformers")
            return result
            
        except Exception as e:
            logger.error(f"Gemini parsing failed: {str(e)}")
            raise
    
    def is_available(self) -> bool:
        """Check if Gemini is available."""
        if not self.api_key:
            return False
        
        try:
            self._get_client()
            return True
        except:
            return False
    
    def get_provider_name(self) -> str:
        return f"Gemini ({self.model})"


# Register with factory
from . import LLMProviderFactory
LLMProviderFactory.register("gemini", GeminiProvider)
