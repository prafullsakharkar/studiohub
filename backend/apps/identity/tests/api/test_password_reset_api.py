from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.services.password_reset import PasswordResetService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestForgotPasswordAPI:
    def test_response_is_generic_for_known_and_unknown_accounts(self, api_client):
        UserFactory.create(email="known@example.com")

        url = reverse("api:v1:identity:forgot-password")

        for email in ("known@example.com", "unknown@example.com"):
            response = api_client.post(url, {"email": email})

            assert response.status_code == 200
            assert (
                response.data["detail"]
                == "If an account exists, a password reset email has been sent."
            )

    def test_auth_compat_alias_is_mounted(self, api_client):
        response = api_client.post(
            reverse("api:v1:auth-compat:auth-forgot-password"),
            {"email": "unknown@example.com"},
        )

        assert response.status_code == 200


@pytest.mark.django_db
class TestResetPasswordAPI:
    def test_reset_password_consumes_token_and_changes_password(self, api_client):
        user = UserFactory.create(email="api-reset@example.com", is_active=True)
        raw = PasswordResetService.request_reset(email=user.email)

        response = api_client.post(
            reverse("api:v1:identity:reset-password"),
            {
                "token": raw,
                "new_password": "api-new-pass-1",
                "confirm_password": "api-new-pass-1",
            },
        )

        assert response.status_code == 200

        user.refresh_from_db()
        assert user.check_password("api-new-pass-1")

    def test_password_confirmation_mismatch_is_rejected(self, api_client):
        user = UserFactory.create(email="api-mismatch@example.com", is_active=True)
        raw = PasswordResetService.request_reset(email=user.email)

        response = api_client.post(
            reverse("api:v1:identity:reset-password"),
            {
                "token": raw,
                "new_password": "api-new-pass-1",
                "confirm_password": "different-pass-1",
            },
        )

        assert response.status_code == 400
        assert "confirm_password" in response.data

    def test_invalid_token_is_rejected(self, api_client):
        response = api_client.post(
            reverse("api:v1:identity:reset-password"),
            {
                "token": "not-a-real-token",
                "new_password": "api-new-pass-1",
                "confirm_password": "api-new-pass-1",
            },
        )

        assert response.status_code == 400
