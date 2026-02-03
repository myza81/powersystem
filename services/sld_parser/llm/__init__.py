"""
Abstract LLM Provider Base Class
Defines interface for all LLM providers (OpenAI, Gemini, Claude, local).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Base class for all LLM providers."""
    
    def __init__(self, api_key: Optional[str] = None, **kwargs):
        """
        Initialize provider with optional API key.
        
        Args:
            api_key: API key for the service (if applicable)
            **kwargs: Provider-specific configuration
        """
        self.api_key = api_key
        self.config = kwargs
    
    @abstractmethod
    def parse_observations(
        self,
        observations: Dict[str, Any],
        prompt: str,
        temperature: float = 0.0
    ) -> Dict[str, Any]:
        """
        Parse raw observations using LLM reasoning.
        
        Args:
            observations: Raw SLD observations dict
            prompt: System prompt with Instruction No.12 rules
            temperature: Sampling temperature (0=deterministic)
        
        Returns:
            Structured JSON dict conforming to Django schema
        
        Raises:
            Exception: If parsing fails or API is unavailable
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this provider is configured and reachable.
        
        Returns:
            True if provider can be used, False otherwise
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Return human-readable provider name."""
        pass


class LLMProviderFactory:
    """Factory for creating LLM provider instances."""
    
    _providers = {}
    
    @classmethod
    def register(cls, name: str, provider_class):
        """Register a provider implementation."""
        cls._providers[name] = provider_class
    
    @classmethod
    def create(cls, name: str, **kwargs) -> LLMProvider:
        """
        Create a provider instance by name.
        
        Args:
            name: Provider name ('openai', 'gemini', 'claude', 'local')
            **kwargs: Provider-specific arguments
        
        Returns:
            LLMProvider instance
        """
        if name not in cls._providers:
            raise ValueError(f"Unknown provider: {name}")
        
        return cls._providers[name](**kwargs)
    
    @classmethod
    def get_available_providers(cls) -> list:
        """Get list of available provider names."""
        available = []
        for name, provider_class in cls._providers.items():
            try:
                provider = provider_class()
                if provider.is_available():
                    available.append(name)
            except:
                pass
        return available
    
    @classmethod
    def auto_select(cls, **kwargs) -> Optional[LLMProvider]:
        """
        Auto-select provider with priority: OpenAI → Gemini → others.
        
        Returns:
            LLMProvider instance or None if none available
        """
        # Priority order
        priority = ['openai', 'gemini']
        
        # Try priority providers first
        for name in priority:
            if name in cls._providers:
                try:
                    provider = cls._providers[name](**kwargs)
                    if provider.is_available():
                        logger.info(f"Auto-selected LLM provider: {name}")
                        return provider
                except Exception as e:
                    logger.debug(f"Provider {name} not available: {str(e)}")
                    continue
        
        # Fallthrough to any other available provider
        for name in cls.get_available_providers():
            if name not in priority:
                try:
                    return cls.create(name, **kwargs)
                except:
                    continue
        
        return None


# Import providers to trigger registration
try:
    from .openai_provider import OpenAIProvider
except ImportError:
    logger.debug("OpenAI provider not available")

try:
    from .gemini_provider import GeminiProvider
except ImportError:
    logger.debug("Gemini provider not available")
