"""
Base validator for Settings bounded context.
"""
from __future__ import annotations

from typing import Any

from apps.core.validators.base import BaseValidator


class SettingsBaseValidator(BaseValidator):
    """
    Base validator for Settings entities.
    """
    
    def __init__(self, **context: Any):
        super().__init__(**context)
        self.errors: dict[str, list[str]] = {}
