from __future__ import annotations

import pytest
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.authentication.token import TokenService
from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestRevokeAllForUser:
    def test_revoke_all_logs_out_sessions_and_blacklists(self):
        user = UserFactory.create(is_active=True)
        refresh1 = RefreshToken.for_user(user)
        refresh2 = RefreshToken.for_user(user)

        UserSession.objects.create(
            user=user,
            session_key=refresh1["jti"],
            refresh_token_jti=refresh1["jti"],
            access_token_jti="acc-jti-1",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh1),
        )
        UserSession.objects.create(
            user=user,
            session_key=refresh2["jti"],
            refresh_token_jti=refresh2["jti"],
            access_token_jti="acc-jti-2",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh2),
        )

        count = TokenService.revoke_all_for_user(user=user)

        assert count == 2
        assert not UserSession.objects.active().by_user(user).exists()
        assert (
            BlacklistedToken.objects.filter(
                token__jti__in=[refresh1["jti"], refresh2["jti"]],
            ).count()
            == 2
        )

    def test_blacklisted_refresh_rejected_by_validation(self):
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

        TokenService.revoke_all_for_user(user=user)

        from apps.identity.authentication.exceptions import SessionRevoked

        with pytest.raises(SessionRevoked):
            JWTService.validate_refresh_token(str(refresh))

    def test_logout_with_already_blacklisted_refresh_does_not_raise(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        refresh.blacklist()  # rotate path already blacklisted it

        # idempotent logout must not 500
        TokenService.logout(
            session=None,
            refresh_token=str(refresh),
        )
