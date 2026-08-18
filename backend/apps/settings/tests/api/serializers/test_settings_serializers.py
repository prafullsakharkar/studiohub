# tests/api/serializers/test_settings.py
"""
Serializer tests for Settings application.
"""

from __future__ import annotations

import pytest
from rest_framework import serializers

from apps.settings.api.serializers.base import SettingsBaseSerializer
from apps.settings.models.category import SettingCategory
from apps.settings.models.definition import SettingDefinition
from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.models.localization import Localization
from apps.settings.models.organization import OrganizationSetting
from apps.settings.models.system import SystemSetting
from apps.settings.models.theme import Theme
from apps.organization.tests.factories import OrganizationFactory
from apps.settings.tests.factories import (
    CategoryFactory,
    DefinitionFactory,
    FeatureFlagFactory,
    LocalizationFactory,
    OrganizationSettingFactory,
    SystemSettingFactory,
    ThemeFactory,
)


class TestSettingsBaseSerializer:
    """Tests for SettingsBaseSerializer."""

    def test_serializer_fields(self) -> None:
        """Test serializer has expected fields."""

        class TestSerializer(SettingsBaseSerializer):
            class Meta:
                model = Theme
                fields = (
                    "id",
                    "uuid",
                    "code",
                    "name",
                    "description",
                    "organization",
                    "theme_type",
                    "created_at",
                    "updated_at",
                )
                read_only_fields = (
                    "id",
                    "uuid",
                    "created_at",
                    "updated_at",
                )

        serializer = TestSerializer()
        assert "uuid" in serializer.fields
        assert "code" in serializer.fields
        assert "name" in serializer.fields

    def test_serializer_read_only_fields(self) -> None:
        """Test serializer has read-only fields."""

        class TestSerializer(SettingsBaseSerializer):
            class Meta:
                model = Theme
                fields = "__all__"
                read_only_fields = (
                    "id",
                    "created_at",
                    "updated_at",
                )

        serializer = TestSerializer()
        assert serializer.fields["id"].read_only is True
        assert serializer.fields["created_at"].read_only is True
        assert serializer.fields["updated_at"].read_only is True


class TestThemeSerializer:
    """Tests for Theme serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, theme: Theme) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.theme import ThemeSerializer

        serializer = ThemeSerializer(theme)
        data = serializer.data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.theme import ThemeSerializer

        data = {
            "name": "Test Theme",
            "code": "test_theme",
            "theme_type": "light",
        }
        serializer = ThemeSerializer(data=data)
        assert serializer.is_valid() is True


class TestCategorySerializer:
    """Tests for Category serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, category: SettingCategory) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.category import SettingCategorySerializer

        serializer = SettingCategorySerializer(category)
        data = serializer.data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.category import SettingCategorySerializer

        data = {
            "name": "Test Category",
            "code": "general",
        }
        serializer = SettingCategorySerializer(data=data)
        assert serializer.is_valid() is True


class TestDefinitionSerializer:
    """Tests for Definition serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, definition: SettingDefinition) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.definition import SettingDefinitionSerializer

        serializer = SettingDefinitionSerializer(definition)
        data = serializer.data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.definition import SettingDefinitionSerializer

        category = CategoryFactory()
        data = {
            "name": "Test Definition",
            "code": "test_definition",
            "data_type": "string",
            "category": category.id,
        }
        serializer = SettingDefinitionSerializer(data=data)
        assert serializer.is_valid() is True


class TestFeatureFlagSerializer:
    """Tests for FeatureFlag serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, feature_flag: FeatureFlag) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.feature_flag import FeatureFlagSerializer

        serializer = FeatureFlagSerializer(feature_flag)
        data = serializer.data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.feature_flag import FeatureFlagSerializer

        data = {
            "name": "Test Feature",
            "code": "test_feature",
            "feature_type": "boolean",
        }
        serializer = FeatureFlagSerializer(data=data)
        assert serializer.is_valid() is True


class TestLocalizationSerializer:
    """Tests for Localization serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, localization: Localization) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.localization import LocalizationSerializer

        serializer = LocalizationSerializer(localization)
        data = serializer.data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.localization import LocalizationSerializer

        data = {
            "name": "Test Localization",
            "code": "test_localization",
            "language": "en",
        }
        serializer = LocalizationSerializer(data=data)
        assert serializer.is_valid() is True


class TestOrganizationSettingSerializer:
    """Tests for OrganizationSetting serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, organization_setting: OrganizationSetting) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.organization import OrganizationSettingSerializer

        serializer = OrganizationSettingSerializer(organization_setting)
        data = serializer.data
        assert "uuid" in data
        assert "value" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.organization import OrganizationSettingSerializer

        definition = DefinitionFactory(
            data_type=SettingDefinition.TYPE_JSON,
        )
        data = {
            "setting": definition.id,
            "organization": OrganizationFactory().id,
            "value": '{"key": "value"}',
        }
        serializer = OrganizationSettingSerializer(data=data)
        assert serializer.is_valid() is True


class TestSystemSettingSerializer:
    """Tests for SystemSetting serializer."""

    @pytest.mark.django_db
    def test_serializer_valid_data(self, system_setting: SystemSetting) -> None:
        """Test serializer with valid data."""
        from apps.settings.api.serializers.system import SystemSettingSerializer

        serializer = SystemSettingSerializer(system_setting)
        data = serializer.data
        assert "uuid" in data
        assert "value" in data

    @pytest.mark.django_db
    def test_serializer_create(self) -> None:
        """Test serializer create method."""
        from apps.settings.api.serializers.system import SystemSettingSerializer

        definition = DefinitionFactory(
            data_type=SettingDefinition.TYPE_JSON,
        )
        data = {
            "setting": definition.id,
            "value": '{"key": "value"}',
        }
        serializer = SystemSettingSerializer(data=data)
        assert serializer.is_valid() is True
