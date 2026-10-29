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
    def test_list_trusted_devices_scoped_to_self(self, authenticated_client, user):
        """Test listing devices returns only the request user's own."""
        TrustedDeviceFactory.create(user=user)
        TrustedDeviceFactory.create()
        response = authenticated_client.get(reverse("api:v1:identity:trusted-device-list"))
        assert response.status_code == 200
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        assert len(results) == 1

    @pytest.mark.django_db
    def test_retrieve_trusted_device_unauthenticated(self, api_client):
        """Test retrieving trusted device without authentication."""
        device = TrustedDeviceFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_trusted_device_authenticated(self, authenticated_client, user):
        """Test retrieving own trusted device with authentication."""
        device = TrustedDeviceFactory.create(user=user)
        response = authenticated_client.get(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_other_users_device_not_found(self, authenticated_client):
        """Test retrieving another user's device is scoped out."""
        device = TrustedDeviceFactory.create()
        response = authenticated_client.get(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 404

    @pytest.mark.django_db
    def test_retrieve_trusted_device_staff_is_self_scoped(self, staff_client):
        """ADR-0033 D4: staff is not an authorization tier; other users' records are 404."""
        device = TrustedDeviceFactory.create()
        response = staff_client.get(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id})
        )
        assert response.status_code == 404

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
        """Trust is minted server-side after MFA; the API cannot create devices."""
        from apps.identity.models import TrustedDevice

        before = TrustedDevice.objects.count()
        response = authenticated_client.post(
            reverse("api:v1:identity:trusted-device-list"),
            {"fingerprint": "test-device-fingerprint"},
        )
        assert response.status_code in (403, 405)
        assert TrustedDevice.objects.count() == before

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
    def test_update_trusted_device_authenticated(self, authenticated_client, user):
        """A client cannot edit a device (e.g. extend trust or un-revoke it)."""
        device = TrustedDeviceFactory.create(user=user, browser="Chrome")
        response = authenticated_client.put(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}),
            {"browser": "Firefox"},
        )
        assert response.status_code in (403, 405)
        device.refresh_from_db()
        assert device.browser == "Chrome"

    @pytest.mark.django_db
    def test_update_other_users_device_not_found(self, authenticated_client):
        """Another user's device is neither editable nor visible."""
        device = TrustedDeviceFactory.create(browser="Chrome")
        response = authenticated_client.patch(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}),
            {"browser": "Firefox"},
        )
        assert response.status_code in (403, 404, 405)
        device.refresh_from_db()
        assert device.browser == "Chrome"

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
    def test_partial_update_trusted_device_authenticated(self, authenticated_client, user):
        """PATCH is refused too: an owner cannot lift their own revocation."""
        from django.utils import timezone

        device = TrustedDeviceFactory.create(user=user, is_trusted=False, revoked_at=timezone.now())
        response = authenticated_client.patch(
            reverse("api:v1:identity:trusted-device-detail", kwargs={"pk": device.id}),
            {"is_trusted": True, "revoked_at": None},
            format="json",
        )
        assert response.status_code in (403, 405)
        device.refresh_from_db()
        assert device.is_trusted is False
        assert device.revoked_at is not None

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
