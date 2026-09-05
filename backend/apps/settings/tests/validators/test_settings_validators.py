# tests/validators/test_settings_validators.py
"""
Validator tests for Settings application.
"""

from __future__ import annotations

from datetime import datetime

from apps.settings.validators.category import SettingCategoryValidator
from apps.settings.validators.definition import SettingDefinitionValidator
from apps.settings.validators.feature_flag import FeatureFlagValidator
from apps.settings.validators.localization import LocalizationValidator
from apps.settings.validators.theme import ThemeValidator


class TestThemeValidator:
    """Tests for ThemeValidator."""

    def test_valid_theme_data(self) -> None:
        """Valid theme colors and typography pass validation."""
        validator = ThemeValidator()
        assert validator.validate(
            primary_color="#3B82F6",
            font_size=14,
            spacing_unit=8,
        ) is True

    def test_invalid_hex_color(self) -> None:
        """Invalid hex colors fail validation."""
        validator = ThemeValidator()
        assert validator.validate(primary_color="blue") is False
        assert "color" in validator.errors

    def test_invalid_font_size(self) -> None:
        """Font size out of range fails validation."""
        validator = ThemeValidator()
        assert validator.validate(font_size=100) is False
        assert "font_size" in validator.errors

    def test_invalid_spacing_unit(self) -> None:
        """Spacing unit out of range fails validation."""
        validator = ThemeValidator()
        assert validator.validate(spacing_unit=500) is False
        assert "spacing_unit" in validator.errors


class TestSettingCategoryValidator:
    """Tests for SettingCategoryValidator."""

    def test_valid_category_data(self) -> None:
        """Valid category data passes validation."""
        validator = SettingCategoryValidator()
        assert validator.validate_code("general") is True
        assert validator.validate_name("General") is True

    def test_invalid_short_code(self) -> None:
        """Too-short category codes fail validation."""
        validator = SettingCategoryValidator()
        assert validator.validate_code("a") is False
        assert "code" in validator.errors

    def test_invalid_short_name(self) -> None:
        """Too-short category names fail validation."""
        validator = SettingCategoryValidator()
        assert validator.validate_name("x") is False
        assert "name" in validator.errors

    def test_invalid_order(self) -> None:
        """Negative order fails validation."""
        validator = SettingCategoryValidator()
        assert validator.validate_order(-1) is False
        assert "order" in validator.errors


class TestSettingDefinitionValidator:
    """Tests for SettingDefinitionValidator."""

    def test_valid_definition_data(self) -> None:
        """Valid definition data passes validation."""
        validator = SettingDefinitionValidator()
        assert validator.validate_code("project.default_fps") is True
        assert validator.validate_name("Default FPS") is True

    def test_invalid_data_type(self) -> None:
        """Unknown data types fail validation."""
        validator = SettingDefinitionValidator()
        assert validator.validate_data_type("binary") is False
        assert "data_type" in validator.errors

    def test_invalid_scope(self) -> None:
        """Unknown scopes fail validation."""
        validator = SettingDefinitionValidator()
        assert validator.validate_scope("global") is False
        assert "scope" in validator.errors

    def test_invalid_default_value_for_integer_type(self) -> None:
        """Non-numeric default value for an integer setting fails."""
        validator = SettingDefinitionValidator()
        assert validator.validate_default_value("abc", "integer") is False
        assert "default_value" in validator.errors


class TestFeatureFlagValidator:
    """Tests for FeatureFlagValidator."""

    def test_valid_feature_flag_data(self) -> None:
        """Valid feature flag data passes validation."""
        validator = FeatureFlagValidator()
        assert validator.validate(
            code="enable_ai",
            percentage=50,
        ) is True

    def test_invalid_percentage(self) -> None:
        """Percentage above 100 fails validation."""
        validator = FeatureFlagValidator()
        assert validator.validate_percentage(150) is False
        assert "percentage" in validator.errors

    def test_dates_end_before_start(self) -> None:
        """End date before start date fails validation."""
        validator = FeatureFlagValidator()
        start = datetime(2026, 1, 10)
        end = datetime(2026, 1, 1)
        assert validator.validate_dates(start, end) is False
        assert "start_date" in validator.errors

    def test_dates_valid_order(self) -> None:
        """Start date before end date passes validation."""
        validator = FeatureFlagValidator()
        start = datetime(2026, 1, 1)
        end = datetime(2026, 1, 10)
        assert validator.validate_dates(start, end) is True


class TestLocalizationValidator:
    """Tests for LocalizationValidator."""

    def test_valid_currency_code(self) -> None:
        """Valid uppercase 3-letter currency code passes."""
        validator = LocalizationValidator()
        assert validator.validate_currency_code("USD") is True

    def test_invalid_currency_code_length(self) -> None:
        """Wrong-length currency code fails."""
        validator = LocalizationValidator()
        assert validator.validate_currency_code("US") is False
        assert "currency_code" in validator.errors

    def test_invalid_currency_code_case(self) -> None:
        """Lowercase currency code fails."""
        validator = LocalizationValidator()
        assert validator.validate_currency_code("usd") is False
        assert "currency_code" in validator.errors

    def test_invalid_week_start(self) -> None:
        """Week start out of range fails."""
        validator = LocalizationValidator()
        assert validator.validate_week_start(8) is False
        assert "week_start" in validator.errors

    def test_valid_week_start(self) -> None:
        """Week start within range passes."""
        validator = LocalizationValidator()
        assert validator.validate_week_start(1) is True
