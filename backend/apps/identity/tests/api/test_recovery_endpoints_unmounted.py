"""
Recovery endpoint mounting policy.

The reset endpoint used to be unmounted because it called a nonexistent
``PasswordService.reset_password`` and had no token-issuance subsystem behind
it. A real single-use, expiring token flow now exists (``PasswordResetService``),
so ``POST /identity/password/reset/`` is mounted and fails closed with a 400 on
invalid tokens. Email verification remains unmounted until a verifiable token
subsystem is implemented.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestRecoveryEndpoints:
    def test_password_reset_is_mounted_and_rejects_invalid_token(self):
        client = APIClient()

        response = client.post(
            "/api/v1/identity/password/reset/",
            {"token": "x", "new_password": "new-pass-1", "confirm_password": "new-pass-1"},
            format="json",
        )

        assert response.status_code == 400

    def test_email_verify_unmounted(self):
        client = APIClient()

        response = client.post(
            "/api/v1/identity/email/verify/",
            {"token": "x"},
            format="json",
        )

        assert response.status_code == 404

    def test_surrounding_self_service_routes_still_mounted(self):
        client = APIClient()

        # password/forgot always returns the generic response, even for
        # unknown accounts.
        forgot = client.post(
            "/api/v1/identity/password/forgot/",
            {"email": "nobody@example.com"},
            format="json",
        )
        assert forgot.status_code == 200

        # change requires authentication; it must not be a 404 either.
        change = client.post(
            "/api/v1/identity/password/change/",
            {"old_password": "x", "new_password": "y", "confirm_password": "y"},
            format="json",
        )
        assert change.status_code != 404
