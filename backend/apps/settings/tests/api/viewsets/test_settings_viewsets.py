# tests/api/viewsets/test_settings_viewsets.py
"""
ViewSet tests for Settings application.

Settings APIs require an authenticated user; staff-gated endpoints
(categories, definitions, system settings) additionally require staff.
"""

from __future__ import annotations

import pytest
from rest_framework import status

from apps.settings.models.definition import SettingDefinition
from apps.settings.models.system import SystemSetting
from apps.settings.models.theme import Theme


class TestThemeViewSet:
    """Tests for ThemeViewSet."""

    @pytest.mark.django_db
    def test_list_viewset(self, authenticated_client, theme: Theme) -> None:
        """Test list endpoint."""
        url = "/api/v1/settings/themes/"
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_list_unauthenticated(self, api_client, theme: Theme) -> None:
        """Anonymous requests are rejected."""
        url = "/api/v1/settings/themes/"
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_retrieve_viewset(self, staff_client, theme: Theme) -> None:
        """Test retrieve endpoint."""
        url = f"/api/v1/settings/themes/{theme.uuid}/"
        response = staff_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(theme.id)

    @pytest.mark.django_db
    def test_retrieve_other_org_theme_isolated(
        self, authenticated_client, theme: Theme
    ) -> None:
        """A user cannot retrieve another org's theme."""
        url = f"/api/v1/settings/themes/{theme.uuid}/"
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_retrieve_invalid_uuid_returns_404(
        self, staff_client
    ) -> None:
        """Invalid UUID returns 404, not 500."""
        url = "/api/v1/settings/themes/not-a-uuid/"
        response = staff_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_create_viewset(self, authenticated_client) -> None:
        """Test create endpoint."""
        url = "/api/v1/settings/themes/"
        data = {
            "name": "Test Theme",
            "code": "viewset_test_theme",
            "theme_type": "light",
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Theme.objects.filter(code="viewset_test_theme").exists()

    @pytest.mark.django_db
    def test_update_viewset(self, staff_client, theme: Theme) -> None:
        """Test update endpoint."""
        url = f"/api/v1/settings/themes/{theme.uuid}/"
        data = {
            "name": "Updated Theme",
        }
        response = staff_client.patch(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        theme.refresh_from_db()
        assert theme.name == "Updated Theme"

    @pytest.mark.django_db
    def test_delete_viewset(self, staff_client, theme: Theme) -> None:
        """Test delete endpoint."""
        url = f"/api/v1/settings/themes/{theme.uuid}/"
        response = staff_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Theme.objects.filter(id=theme.id).count() == 0


class TestDefinitionViewSet:
    """Tests for SettingDefinitionViewSet (staff-gated)."""

    @pytest.mark.django_db
    def test_list_requires_staff(
        self, authenticated_client, definition: SettingDefinition
    ) -> None:
        """Regular users are denied; staff can list."""
        url = "/api/v1/settings/definitions/"
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_list_staff(self, staff_client, definition: SettingDefinition) -> None:
        """Staff can list definitions."""
        url = "/api/v1/settings/definitions/"
        response = staff_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_retrieve_staff(
        self, staff_client, definition: SettingDefinition
    ) -> None:
        """Staff can retrieve a definition."""
        url = f"/api/v1/settings/definitions/{definition.uuid}/"
        response = staff_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(definition.id)


class TestSystemSettingViewSet:
    """Tests for SystemSettingViewSet (staff-gated)."""

    @pytest.mark.django_db
    def test_list_requires_staff(
        self, authenticated_client, system_setting: SystemSetting
    ) -> None:
        """Regular users are denied."""
        url = "/api/v1/settings/system-settings/"
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_list_staff(self, staff_client, system_setting: SystemSetting) -> None:
        """Staff can list system settings."""
        url = "/api/v1/settings/system-settings/"
        response = staff_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_retrieve_staff(
        self, staff_client, system_setting: SystemSetting
    ) -> None:
        """Staff can retrieve a system setting."""
        url = f"/api/v1/settings/system-settings/{system_setting.uuid}/"
        response = staff_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(system_setting.id)


class TestOtherViewSets:
    """Smoke tests for the remaining settings viewsets."""

    @pytest.mark.django_db
    def test_categories_require_staff(self, authenticated_client) -> None:
        """Category list requires staff."""
        response = authenticated_client.get("/api/v1/settings/categories/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_categories_list_staff(self, staff_client) -> None:
        """Staff can list categories."""
        response = staff_client.get("/api/v1/settings/categories/")
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_feature_flags_list(self, authenticated_client) -> None:
        """Authenticated users can list feature flags."""
        response = authenticated_client.get("/api/v1/settings/feature-flags/")
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_localizations_list(self, authenticated_client) -> None:
        """Authenticated users can list localizations."""
        response = authenticated_client.get("/api/v1/settings/localizations/")
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_organization_settings_list(self, authenticated_client) -> None:
        """Authenticated users can list organization settings."""
        response = authenticated_client.get(
            "/api/v1/settings/organization-settings/"
        )
        assert response.status_code == status.HTTP_200_OK
