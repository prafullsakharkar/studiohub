from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestLogoutTerminatesSession:
    def test_logout_with_refresh_marks_session_logged_out(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh),
        )

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/auth/logout/",
            {"refresh": str(refresh)},
            format="json",
        )

        assert response.status_code == 200
        session = UserSession.objects.get(session_key=refresh["jti"])
        assert session.status == SessionStatus.LOGGED_OUT
        assert session.logged_out_at is not None

    def test_logout_without_refresh_uses_access_jti(self):
        from rest_framework_simplejwt.tokens import AccessToken

        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        session = UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh),
        )

        access = AccessToken()
        access["jti"] = "acc-jti"

        client = APIClient()
        client.force_authenticate(user=user, token=access)

        response = client.post(
            "/api/v1/auth/logout/",
            {},
            format="json",
        )

        assert response.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.LOGGED_OUT
