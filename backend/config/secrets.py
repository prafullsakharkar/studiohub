"""
Secrets management utilities.

This module provides secure handling of sensitive configuration values,
including validation, masking, and best practices for secrets management.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic import BaseModel


class SecretsManager:
    """
    Manages sensitive configuration values with security best practices.
    
    Features:
    - Automatic masking of sensitive values in logs
    - Validation of secret strength
    - Support for multiple secret sources (env, vault, etc.)
    """
    
    # Patterns for common secrets that should be masked
    SECRET_PATTERNS = [
        r"password",
        r"secret",
        r"token",
        r"api[_-]?key",
        r"private[_-]?key",
        r"access[_-]?key",
        r"credential",
    ]
    
    def __init__(self, settings: BaseModel):
        """
        Initialize the secrets manager.
        
        Args:
            settings: Pydantic settings object containing configuration
        """
        self._settings = settings
        self._secret_fields = self._identify_secret_fields()
    
    def _identify_secret_fields(self) -> list[str]:
        """Identify fields that likely contain secrets based on naming patterns."""
        secret_fields = []
        for field_name in self._settings.model_fields:
            field_name_lower = field_name.lower()
            for pattern in self.SECRET_PATTERNS:
                if re.search(pattern, field_name_lower):
                    secret_fields.append(field_name)
                    break
        return secret_fields
    
    def mask_value(self, value: str, visible_chars: int = 4) -> str:
        """
        Mask a sensitive value for safe logging.
        
        Args:
            value: The sensitive value to mask
            visible_chars: Number of characters to show at the start
            
        Returns:
            Masked string with * characters
        """
        if not value or len(value) <= visible_chars:
            return "*" * len(value)
        return value[:visible_chars] + "*" * (len(value) - visible_chars)
    
    def mask_dict(self, data: dict, exclude_keys: list[str] | None = None) -> dict:
        """
        Create a masked copy of a dictionary for logging.
        
        Args:
            data: Dictionary to mask
            exclude_keys: Keys to exclude from masking
            
        Returns:
            Dictionary with sensitive values masked
        """
        exclude_keys = exclude_keys or []
        masked = {}
        for key, value in data.items():
            if key in exclude_keys:
                masked[key] = value
            elif self._is_secret_key(key):
                if isinstance(value, str):
                    masked[key] = self.mask_value(value)
                else:
                    masked[key] = "***"
            else:
                masked[key] = value
        return masked
    
    def _is_secret_key(self, key: str) -> bool:
        """Check if a key name suggests it contains a secret."""
        key_lower = key.lower()
        for pattern in self.SECRET_PATTERNS:
            if re.search(pattern, key_lower):
                return True
        return False
    
    def validate_secret_strength(self, secret: str, min_length: int = 16) -> dict:
        """
        Validate the strength of a secret value.
        
        Args:
            secret: The secret to validate
            min_length: Minimum required length
            
        Returns:
            Dictionary with validation results
        """
        result = {
            "is_valid": True,
            "length": len(secret),
            "min_length": min_length,
            "meets_length": len(secret) >= min_length,
            "has_uppercase": bool(re.search(r"[A-Z]", secret)),
            "has_lowercase": bool(re.search(r"[a-z]", secret)),
            "has_digit": bool(re.search(r"\d", secret)),
            "has_special": bool(re.search(r"[!@#$%^&*(),.?\":{}|<>]", secret)),
        }
        
        result["is_valid"] = all([
            result["meets_length"],
            result["has_uppercase"],
            result["has_lowercase"],
            result["has_digit"],
        ])
        
        return result
    
    def get_masked_settings(self) -> dict:
        """Get settings with all secret values masked."""
        masked = {}
        for field_name in self._settings.model_fields:
            value = getattr(self._settings, field_name)
            if field_name in self._secret_fields and isinstance(value, str):
                masked[field_name] = self.mask_value(value)
            else:
                masked[field_name] = value
        return masked


def get_secrets_manager() -> SecretsManager:
    """
    Get a configured secrets manager instance.
    
    Returns:
        SecretsManager instance
    """
    from config.env import settings
    
    return SecretsManager(settings)


# Global secrets manager instance
_secrets_manager: SecretsManager | None = None


def get_secrets() -> SecretsManager:
    """
    Get or create the global secrets manager instance.
    
    Returns:
        Global SecretsManager instance
    """
    global _secrets_manager
    if _secrets_manager is None:
        _secrets_manager = get_secrets_manager()
    return _secrets_manager
