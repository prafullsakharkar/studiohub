"""
Theme admin for Settings application.

This module re-exports ThemeAdmin from settings.py for test imports.
"""

from apps.settings.admin.settings import ThemeAdmin

__all__ = ["ThemeAdmin"]
