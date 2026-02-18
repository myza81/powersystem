"""
OpenAI Provider Implementation
"""

from . import LLMProvider
from typing import Dict, Any
import json
import os
import logging
import re

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""
    
    def __init__(self, api_key: str = None, model: str = "gpt-4o", **kwargs):
        super().__init__(api_key, **kwargs)
        self.model = model
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._client = None
    
    def _get_client(self):
        """Lazy-load OpenAI client."""
        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError("openai package not installed. Run: pip install openai")
        return self._client
    
    def parse_observations(
        self,
        observations: Dict[str, Any],
        prompt: str,
        temperature: float = 0.0
    ) -> Dict[str, Any]:
        """Parse observations using OpenAI GPT."""
        client = self._get_client()
        
        try:
            response = client.chat.completions.create(
                model=self.model,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": json.dumps(observations, indent=2)}
                ]
            )
            
            content = response.choices[0].message.content
            
            # Log only minimal metadata to avoid leaking document-derived content.
            if content:
                logger.info(f"OpenAI response length: {len(content)} chars")
            else:
                logger.error("OpenAI returned None/empty content")
                raise ValueError("OpenAI response is empty")
            
            # Extract JSON from markdown code blocks if present
            if "```json" in content:
                json_match = re.search(r'```json\s+(.*?)\s+```', content, re.DOTALL)
                if json_match:
                    content = json_match.group(1)
                    logger.debug("Extracted JSON from markdown block")
            elif "```" in content:
                content = content.replace("```", "").strip()
                logger.debug("Removed markdown backticks")
            
            result = json.loads(content)
            logger.info(f"OpenAI parsing succeeded: {len(result.get('transformers', []))} transformers, {len(result.get('incoming_bays', []))} bays")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"OpenAI parsing failed: {str(e)}")
            raise
    
    def is_available(self) -> bool:
        """Check if OpenAI is available."""
        if not self.api_key:
            return False
        
        try:
            self._get_client()
            return True
        except:
            return False
    
    def get_provider_name(self) -> str:
        return f"OpenAI ({self.model})"


# Register with factory
from . import LLMProviderFactory
LLMProviderFactory.register("openai", OpenAIProvider)
