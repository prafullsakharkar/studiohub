"""
H5 — trusted-device revoke endpoint: crash + cross-user IDOR.

View called the selector with device_id bound positionally (TypeError),
ownership was never filtered, and the service/validator write/read
nonexistent ``trusted``/``revoked`` attributes instead of the real
``is_trusted``/``revoked_at`` columns. Contract:

* owner can revoke own device (200, row revoked via real columns)
* cross-user device id → 404
* nonexistent device id → 404
* already-revoked device → validation error (400)
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import TrustedDevice
from apps.identity.tests.factories import TrustedDeviceFactory, UserFactory


def _revoke(client, device_id):
    return client.post(
        reverse("api:v1:identity:trusted-device-revoke"),
        {"device_id": str(device_id)},
        format="json",
    )


@pytest.mark.django_db
class TestTrustedDeviceRevoke:
    def test_owner_can_revoke_own_device(self):
        user = UserFactory.create(is_staff=True, is_superuser=True)
        device = TrustedDeviceFactory.create(user=user, is_trusted=True)

        client = APIClient()
        client.force_authenticate(user=user)

        response = _revoke(client, device.id)

        assert response.status_code == 200
        device.refresh_from_db()
        assert device.is_trusted is False
        assert device.revoked_at is not None

    def test_revoking_older_device_of_superuser_scenario_is_ownership_scoped(
        self,
    ):
        """Owners revoke only their own devices even with staff rights."""
        owner = UserFactory.create()
        other_user = UserFactory.create(is_staff=True, is_superuser=True)
        device = TrustedDeviceFactory.create(user=owner, is_trusted=True)

        client = APIClient()
        client.force_authenticate(user=other_user)

        response = _revoke(client, device.id)

        assert response.status_code == 404
        device.refresh_from_db()
        assert device.is_trusted is True
        assert device.revoked_at is None

    def test_nonexistent_device_returns_404(self):
        user = UserFactory.create(is_staff=True, is_superuser=True)

        client = APIClient()
        client.force_authenticate(user=user)

        response = _revoke(client, "00000000-0000-4000-8000-000000000000")

        assert response.status_code == 404

    def test_already_revoked_device_rejected(self):
        user = UserFactory.create(is_staff=True, is_superuser=True)
        device = TrustedDeviceFactory.create(
            user=user,
            is_trusted=False,
            revoked_at=timezone.now() - timedelta(days=1),
        )

        client = APIClient()
        client.force_authenticate(user=user)

        response = _revoke(client, device.id)

        assert response.status_code == 400
        assert "revoked" in str(response.data).lower()
        device.refresh_from_db()
        assert TrustedDevice.objects.get(pk=device.pk).revoked_at is not None

    def test_revoke_requires_authentication(self):
        client = APIClient()

        response = _revoke(client, "00000000-0000-4000-8000-000000000000")

        assert response.status_code == 401
