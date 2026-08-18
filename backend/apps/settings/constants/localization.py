"""
Localization codes for standard localizations.
"""
from __future__ import annotations


class LocalizationCodes:
    """
    Standard localization codes.
    
    These codes are used to identify and reference localizations
    throughout the application.
    """
    
    # Default localizations
    DEFAULT_EN = "default_en"
    DEFAULT_HI = "default_hi"
    DEFAULT_ES = "default_es"
    
    # Country-specific localizations
    INDIA = "india"
    USA = "usa"
    UK = "uk"
    UAE = "uae"
    AUSTRALIA = "australia"
    
    ALL = [
        DEFAULT_EN,
        DEFAULT_HI,
        DEFAULT_ES,
        INDIA,
        USA,
        UK,
        UAE,
        AUSTRALIA,
    ]
