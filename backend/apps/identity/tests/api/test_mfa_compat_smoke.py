"""
Smoke tests for the MFA compat shim views.

These views previously called MFA service methods with wrong signatures;
every call raised TypeError internally (masked by broad except handlers),
so endpoints silently degraded. These tests pin the corrected behavior.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory


@pytest.fixture
def auth_client(db):
    user = UserFactory.create()
    api = APIClient()
    api.force_authenticate(user=user)
    return api, user


@pytest.mark.django_db
class TestMFATOTPCompat:
    def test_setup_returns_secret_and_uris(self, auth_client):
        api, _user = auth_client

        response = api.get(reverse("api:v1:identity:mfa-totp-setup"))

        assert response.status_code == 200
        data = response.json()
        assert data["secret"]
        assert data["uri"].startswith("otpauth://totp/")
        assert data["qr_code"]

    def test_enable_requires_secret_and_code(self, auth_client):
        api, _user = auth_client

        response = api.post(
            reverse("api:v1:identity:mfa-totp-enable"), {}, format="json"
        )

        assert response.status_code == 400

    def test_enable_with_wrong_code_fails_cleanly(self, auth_client):
        api, _user = auth_client

        setup = api.get(reverse("api:v1:identity:mfa-totp-setup"))
        secret = setup.json()["secret"]

        response = api.post(
            reverse("api:v1:identity:mfa-totp-enable"),
            {"secret": secret, "code": "000000"},
            format="json",
        )

        # Wrong code must fail with a clean 400, never a 500/TypeError text.
        assert response.status_code == 400

    def test_verify_without_enrollment_is_clean_400(self, auth_client):
        api, _user = auth_client

        response = api.post(
            reverse("api:v1:identity:mfa-totp-verify"),
            {"code": "000000"},
            format="json",
        )

        assert response.status_code == 400

    def test_verify_with_wrong_code_returns_invalid(self, auth_client):
        from apps.identity.choices.mfa import MFAStatus
        from apps.identity.models import UserMFA
        from apps.identity.services.mfa.facade import MFAService

        api, user = auth_client
        MFAService.enroll(user=user)
        UserMFA.objects.filter(user=user).update(status=MFAStatus.ENABLED)

        response = api.post(
            reverse("api:v1:identity:mfa-totp-verify"),
            {"code": "000000"},
            format="json",
        )

        assert response.status_code == 200
        assert response.json()["valid"] is False

    def test_recovery_codes_endpoint_works(self, auth_client):
        api, _user = auth_client

        response = api.get(reverse("api:v1:identity:mfa-recovery-codes"))

        assert response.status_code == 200
        assert isinstance(response.json()["codes"], list)
