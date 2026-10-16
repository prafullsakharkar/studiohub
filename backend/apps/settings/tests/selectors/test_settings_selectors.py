# tests/selectors/test_settings_selectors.py
"""
Selector tests for Settings application.
"""

from __future__ import annotations

import pytest

from apps.settings.selectors.category import SettingCategorySelector
from apps.settings.selectors.definition import SettingDefinitionSelector
from apps.settings.selectors.feature_flag import FeatureFlagSelector
from apps.settings.selectors.localization import LocalizationSelector
from apps.settings.selectors.system import SystemSettingSelector
from apps.settings.selectors.theme import ThemeSelector


class TestThemeSelector:
    """Tests for ThemeSelector."""

    @pytest.mark.django_db
    def test_get_by_code(self) -> None:
        """Get a theme by its code."""
        from apps.settings.tests.factories import ThemeFactory

        theme = ThemeFactory()
        assert ThemeSelector.get_by_code(theme.code).id == theme.id

    @pytest.mark.django_db
    def test_active(self) -> None:
        """Active themes only."""
        from apps.settings.tests.factories import ThemeFactory

        active = ThemeFactory(is_active=True)
        ThemeFactory(is_active=False)
        assert active in ThemeSelector.active()

    @pytest.mark.django_db
    def test_get_default(self) -> None:
        """Default theme is the first active theme."""
        from apps.settings.tests.factories import ThemeFactory

        default = ThemeFactory(is_active=True)
        _default = ThemeSelector.get_default()
        assert _default is not None
        assert _default.id == default.id

    @pytest.mark.django_db
    def test_get_queryset_without_request(self) -> None:
        """get_queryset returns all rows without a request."""
        from apps.settings.tests.factories import ThemeFactory

        theme = ThemeFactory()
        assert theme in ThemeSelector.get_queryset()


class TestSettingCategorySelector:
    """Tests for SettingCategorySelector."""

    @pytest.mark.django_db
    def test_get_by_code(self) -> None:
        """Get a category by its code."""
        from apps.settings.tests.factories import CategoryFactory

        category = CategoryFactory()
        assert SettingCategorySelector.get_by_code(category.code).id == category.id

    @pytest.mark.django_db
    def test_active(self) -> None:
        """Active categories only."""
        from apps.settings.tests.factories import CategoryFactory

        active = CategoryFactory(is_active=True)
        CategoryFactory(is_active=False)
        assert active in SettingCategorySelector.active()


class TestSettingDefinitionSelector:
    """Tests for SettingDefinitionSelector."""

    @pytest.mark.django_db
    def test_get_by_code(self) -> None:
        """Get a definition by its code."""
        from apps.settings.tests.factories import DefinitionFactory

        definition = DefinitionFactory()
        assert (
            SettingDefinitionSelector.get_by_code(definition.code).id
            == definition.id
        )

    @pytest.mark.django_db
    def test_by_scope(self) -> None:
        """Filter definitions by scope."""
        from apps.settings.tests.factories import DefinitionFactory

        system = DefinitionFactory(scope="system")
        assert system in SettingDefinitionSelector.by_scope("system")


class TestFeatureFlagSelector:
    """Tests for FeatureFlagSelector."""

    @pytest.mark.django_db
    def test_get_by_code(self) -> None:
        """Get a feature flag by its code."""
        from apps.settings.tests.factories import FeatureFlagFactory

        flag = FeatureFlagFactory()
        assert FeatureFlagSelector.get_by_code(flag.code).id == flag.id

    @pytest.mark.django_db
    def test_active(self) -> None:
        """Active (enabled) flags only."""
        from apps.settings.tests.factories import FeatureFlagFactory

        enabled = FeatureFlagFactory(status="enabled")
        FeatureFlagFactory(status="disabled")
        assert enabled in FeatureFlagSelector.active()


class TestLocalizationSelector:
    """Tests for LocalizationSelector."""

    @pytest.mark.django_db
    def test_get_by_code(self) -> None:
        """Get a localization by its code."""
        from apps.settings.tests.factories import LocalizationFactory

        localization = LocalizationFactory()
        assert (
            LocalizationSelector.get_by_code(localization.code).id
            == localization.id
        )

    @pytest.mark.django_db
    def test_get_default(self) -> None:
        """Default localization is the first active localization."""
        from apps.settings.tests.factories import LocalizationFactory

        default = LocalizationFactory(is_active=True)
        _default = LocalizationSelector.get_default()
        assert _default is not None
        assert _default.id == default.id


class TestSystemSettingSelector:
    """Tests for SystemSettingSelector."""

    @pytest.mark.django_db
    def test_get_by_setting(self) -> None:
        """Get a system setting by its definition code."""
        from apps.settings.tests.factories import SystemSettingFactory

        setting = SystemSettingFactory()
        result = SystemSettingSelector.get_by_setting(setting.setting.code)
        assert result.id == setting.id
