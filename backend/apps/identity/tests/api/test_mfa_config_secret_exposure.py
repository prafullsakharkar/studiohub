"""
C2 (API half) — ``GET /identity/mfa/config/`` must not echo the TOTP secret.

The stored TOTP secret is a bearer-equivalent possession factor; returning
it in the config response puts it on the wire after enrollment. The
provisioning secret belongs to the one-time setup flow only.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.models import UserMFA
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestMFAConfigSecretExposure:
    def test_config_does_not_echo_totp_secret(self):
        user = UserFactory.create(is_staff=True, is_superuser=True)
        UserMFA.objects.create(
            user=user,
            totp_secret="JBSWY3DPEHPK3PXPSIMULATED",
            status="enabled",
            is_verified=True,
        )

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/v1/identity/mfa/config/")

        assert response.status_code == 200
        assert response.data["totp"]["verified"] is True
        assert "secret" not in response.data["totp"]
        assert "JBSWY3DPEHPK3PXPSIMULATED" not in str(response.content, "utf-8")
