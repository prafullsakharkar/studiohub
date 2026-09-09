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
    def test_authenticated_user_can_create_trusted_device(self, authenticated_client):
        """Test that authenticated user can create trusted device."""
        response = authenticated_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_staff_user_can_create_trusted_device(self, staff_client):
        """Test that staff user can create trusted device."""
        response = staff_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_admin_user_can_create_trusted_device(self, admin_client):
        """Test that admin user can create trusted device."""
        response = admin_client.post(
            "/api/v1/identity/trusted-devices/",
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code == 201

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
    def test_authenticated_user_can_update_own_trusted_device(self, authenticated_client, user):
        """Test that authenticated user can update own trusted device."""
        device = TrustedDeviceFactory.create(user=user)
        response = authenticated_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Chrome"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_staff_user_can_update_trusted_device(self, staff_client):
        """Test that staff user can update trusted device."""
        device = TrustedDeviceFactory.create()
        response = staff_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Chrome"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_update_trusted_device(self, admin_client):
        """Test that admin user can update trusted device."""
        device = TrustedDeviceFactory.create()
        response = admin_client.patch(
            f"/api/v1/identity/trusted-devices/{device.id}/",
            {"browser": "Chrome"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_trusted_device(self):
        """Test that anonymous user cannot delete trusted device."""
        device = TrustedDeviceFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_other_trusted_device(
        self, authenticated_client
    ):
        """Test that authenticated user cannot delete other trusted device."""
        device = TrustedDeviceFactory.create()
        response = authenticated_client.delete(
            f"/api/v1/identity/trusted-devices/{device.id}/"
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_delete_trusted_device(self, staff_client):
        """Test that staff user can delete trusted device."""
        device = TrustedDeviceFactory.create()
        response = staff_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_admin_user_can_delete_trusted_device(self, admin_client):
        """Test that admin user can delete trusted device."""
        device = TrustedDeviceFactory.create()
        response = admin_client.delete(f"/api/v1/identity/trusted-devices/{device.id}/")
        assert response.status_code == 204
