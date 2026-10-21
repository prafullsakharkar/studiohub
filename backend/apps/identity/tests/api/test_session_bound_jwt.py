from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestSessionBoundJWT:
    def test_valid_session_authenticates(self):
        user = UserFactory.create(is_active=True)
        access, refresh = JWTService.create_token_pair(user)
        # login flow creates the session; simulate it
        UserSession.objects.create(
            user=user,
            session_key="s1",
            refresh_token_jti="r1",
            access_token_jti=JWTService.get_jti(JWTService.decode_access_token(access)),
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(RefreshToken(refresh)),
        )

        client = APIClient()
        response = client.get(
            "/api/v1/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        assert response.status_code == 200

    def test_logged_out_session_rejected(self):
        user = UserFactory.create(is_active=True)
        access, refresh = JWTService.create_token_pair(user)
        UserSession.objects.create(
            user=user,
            session_key="s2",
            refresh_token_jti="r2",
            access_token_jti=JWTService.get_jti(JWTService.decode_access_token(access)),
            status=SessionStatus.LOGGED_OUT,
            expires_at=JWTService.get_expiration(RefreshToken(refresh)),
        )

        from django.core.cache import cache

        cache.clear()  # force cache miss -> DB truth

        client = APIClient()
        response = client.get(
            "/api/v1/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        assert response.status_code == 401

    def test_missing_session_fails_closed(self):
        user = UserFactory.create(is_active=True)
        access, _ = JWTService.create_token_pair(user)
        # no UserSession row at all

        client = APIClient()
        response = client.get(
            "/api/v1/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        assert response.status_code == 401
