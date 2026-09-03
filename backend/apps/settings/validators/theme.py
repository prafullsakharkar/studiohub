"""
Theme validator.
"""
from __future__ import annotations

import re
from typing import Any

from apps.settings.validators.base import SettingsBaseValidator


class ThemeValidator(SettingsBaseValidator):
    """
    Validator for Theme.
    """
    
    def validate_hex_color(self, color: str) -> bool:
        """
        Validate hex color format.
        """
        pattern = r"^#[0-9A-Fa-f]{6}$"
        if not re.match(pattern, color):
            self.errors["color"] = ["Color must be a valid hex color (e.g., #3B82F6)"]
            return False
        
        return True
    
    def validate_font_size(self, font_size: int) -> bool:
        """
        Validate font size is reasonable.
        """
        if not isinstance(font_size, int):
            self.errors["font_size"] = ["Font size must be an integer"]
            return False
        
        if font_size < 8 or font_size > 72:
            self.errors["font_size"] = ["Font size must be between 8 and 72"]
            return False
        
        return True
    
    def validate_spacing_unit(self, spacing_unit: int) -> bool:
        """
        Validate spacing unit is reasonable.
        """
        if not isinstance(spacing_unit, int):
            self.errors["spacing_unit"] = ["Spacing unit must be an integer"]
            return False
        
        if spacing_unit < 2 or spacing_unit > 100:
            self.errors["spacing_unit"] = ["Spacing unit must be between 2 and 100"]
            return False
        
        return True
    
    def validate(self, **data: Any) -> bool:
        """
        Validate all fields.
        """
        self.errors = {}
        
        is_valid = True
        
        # Validate colors if provided
        color_fields = [
            "primary_color",
            "secondary_color",
            "accent_color",
            "background_color",
            "surface_color",
            "text_primary",
            "text_secondary",
            "border_color",
        ]
        
        for field in color_fields:
            if field in data and not self.validate_hex_color(data[field]):
                is_valid = False
        
        if "font_size" in data and not self.validate_font_size(data["font_size"]):
            is_valid = False
        
        if "spacing_unit" in data and not self.validate_spacing_unit(data["spacing_unit"]):
            is_valid = False
        
        return is_valid
