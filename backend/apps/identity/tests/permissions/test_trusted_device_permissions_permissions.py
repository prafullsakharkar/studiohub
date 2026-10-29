"""
Identity trusted device permissions tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import TrustedDeviceFactory


class TestTrustedDevicePermissions:
    """Tests for TrustedDevice permissions."""

    @pytest.fixture(autouse=True)
    def _inject_api_client(self, api_client):
        """Expose the API client to tests using ``self.api_client``."""
        self.api_client = api_client

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_trusted_device_list(self):
        """Test that anonymous user cannot view trusted device list."""
        response = self.api_client.get("/api/v1/identity/trusted-devices/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_can_view_trusted_device_list(self, authenticated_client):
        """Test that authenticated user can view trusted device list."""
        response = authenticated_client.get("/api/v1/identity/trusted-devices/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_staff_user_can_view_trusted_device_list(self, staff_client):
        """Test that staff user can view trusted device list."""
        response = staff_client.get("/api/v1/identity/trusted-devices/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_view_trusted_device_list(self, admin_client):
        """Test that admin user can view trusted device list."""
        response = admin_client.get("/api/v1/identity/trusted-devices/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create_trusted_device(self):
        """Test that anonymous user cannot create trusted device."""
        response = self.api_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_create_trusted_device(self, authenticated_client):
        """No actor can create a trusted device through the API."""
        response = authenticated_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code in (403, 405)

    @pytest.mark.django_db
    def test_staff_user_cannot_create_trusted_device(self, staff_client):
        """No actor can create a trusted device through the API."""
        response = staff_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code in (403, 405)

    @pytest.mark.django_db
    def test_admin_user_cannot_create_trusted_device(self, admin_client):
        """No actor can create a trusted device through the API."""
        response = admin_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code in (403, 405)

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update_trusted_device(self):
        """Test that anonymous user cannot update trusted device."""
        device = TrustedDeviceFactory.create()
        response = self.api_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Chrome"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_update_own_trusted_device(self, authenticated_client, user):
        """Even the owner cannot edit trust fields."""
        device = TrustedDeviceFactory.create(user=user, browser="Chrome")
        response = authenticated_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Firefox"},
        )
        assert response.status_code in (403, 405)
        device.refresh_from_db()
        assert device.browser == "Chrome"

    @pytest.mark.django_db
    def test_staff_user_cannot_update_other_device(self, staff_client):
        """ADR-0033 D4: staff is not an authorization tier."""
        device = TrustedDeviceFactory.create(browser="Chrome")
        response = staff_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Firefox"},
        )
        assert response.status_code in (403, 404, 405)
        device.refresh_from_db()
        assert device.browser == "Chrome"

    @pytest.mark.django_db
    def test_admin_user_cannot_update_trusted_device(self, admin_client):
        """Not even a superuser edits a device; trust is server-minted."""
        device = TrustedDeviceFactory.create(browser="Chrome")
        response = admin_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Firefox"},
        )
        assert response.status_code in (403, 405)
        device.refresh_from_db()
        assert device.browser == "Chrome"

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_trusted_device(self):
        """Test that anonymous user cannot delete trusted device."""
        device = TrustedDeviceFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_other_trusted_device(self, authenticated_client):
        """Test that authenticated user cannot delete other trusted device."""
        device = TrustedDeviceFactory.create()
        response = authenticated_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_cannot_delete_other_device(self, staff_client):
        """ADR-0033 D4: staff is not an authorization tier."""
        device = TrustedDeviceFactory.create()
        response = staff_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 404

    @pytest.mark.django_db
    def test_admin_user_can_delete_trusted_device(self, admin_client):
        """Test that admin user can delete trusted device."""
        device = TrustedDeviceFactory.create()
        response = admin_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 204
