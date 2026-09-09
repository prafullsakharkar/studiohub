# tests/admin/test_settings_admin.py
"""
Admin tests for Settings application.
"""

from __future__ import annotations

from django.contrib.admin.sites import AdminSite

from apps.settings.admin.theme import ThemeAdmin
from apps.settings.models.theme import Theme


class TestThemeAdmin:
    """Tests for ThemeAdmin."""

    def test_admin_list_display(self) -> None:
        """Test list_display configuration."""
        admin = ThemeAdmin(Theme, AdminSite())
        assert "code" in admin.list_display
        assert "name" in admin.list_display
        assert "theme_type" in admin.list_display
        assert "created_at" in admin.list_display

    def test_admin_search_fields(self) -> None:
        """Test search_fields configuration."""
        admin = ThemeAdmin(Theme, AdminSite())
        assert "code" in admin.search_fields
        assert "name" in admin.search_fields
        assert "description" in admin.search_fields

    def test_admin_list_filter(self) -> None:
        """Test list_filter configuration."""
        admin = ThemeAdmin(Theme, AdminSite())
        assert "theme_type" in admin.list_filter
        assert "created_at" in admin.list_filter

    def test_admin_readonly_fields(self) -> None:
        """Test readonly_fields configuration."""
        admin = ThemeAdmin(Theme, AdminSite())
        assert "id" in admin.readonly_fields
        assert "created_at" in admin.readonly_fields
        assert "updated_at" in admin.readonly_fields
