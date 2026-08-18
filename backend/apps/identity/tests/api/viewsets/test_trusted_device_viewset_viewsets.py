"""
Identity trusted device viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import TrustedDeviceFactory


class TestTrustedDeviceViewSet:
    """Tests for TrustedDeviceViewSet."""

    @pytest.mark.django_db
    def test_list_trusted_devices_unauthenticated(self, api_client):
        """Test listing trusted devices without authentication."""
        response = api_client.get(reverse("api:v1:identity:trusted-device-list"))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_trusted_devices_authenticated(self, authenticated_client):
        """Test listing trusted devices with authentication."""
        response = authenticated_client.get(reverse("api:v1:identity:trusted-device-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_trusted_device_unauthenticated(self, api_client):
        """Test retrieving trusted device without authentication."""
        device = TrustedDeviceFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_trusted_device_authenticated(self, authenticated_client):
        """Test retrieving trusted device with authentication."""
        device = TrustedDeviceFactory.create()
        response = authenticated_client.get(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_create_trusted_device_unauthenticated(self, api_client):
        """Test creating trusted device without authentication."""
        data = {
            "device_name": "Test Device",
        }
        response = api_client.post(reverse("api:v1:identity:trusted-device-list"), data)
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_trusted_device_authenticated(self, authenticated_client):
        """Test creating trusted device with authentication."""
        data = {
            "fingerprint": "test-device-fingerprint",
        }
        response = authenticated_client.post(
            reverse("api:v1:identity:trusted-device-list"), data
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_update_trusted_device_unauthenticated(self, api_client):
        """Test updating trusted device without authentication."""
        device = TrustedDeviceFactory.create()
        data = {"device_name": "Updated Device"}
        response = api_client.put(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_trusted_device_authenticated(self, authenticated_client):
        """Test updating trusted device with authentication."""
        device = TrustedDeviceFactory.create()
        data = {"browser": "Firefox"}
        response = authenticated_client.patch(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_partial_update_trusted_device_unauthenticated(self, api_client):
        """Test partially updating trusted device without authentication."""
        device = TrustedDeviceFactory.create()
        data = {"device_name": "Updated Device"}
        response = api_client.patch(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_partial_update_trusted_device_authenticated(self, authenticated_client):
        """Test partially updating trusted device with authentication."""
        device = TrustedDeviceFactory.create()
        data = {"device_name": "Updated Device"}
        response = authenticated_client.patch(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_destroy_trusted_device_unauthenticated(self, api_client):
        """Test deleting trusted device without authentication."""
        device = TrustedDeviceFactory.create()
        response = api_client.delete(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_destroy_trusted_device_authenticated(self, authenticated_client):
        """Test deleting trusted device with authentication."""
        device = TrustedDeviceFactory.create()
        response = authenticated_client.delete(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 403
