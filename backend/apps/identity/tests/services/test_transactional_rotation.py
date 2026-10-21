from __future__ import annotations

from unittest import mock

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.authentication.token import TokenService
from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestTransactionalRotation:
    def test_failed_session_update_rolls_back_rotation(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        session = UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh),
        )
        old_jti = session.refresh_token_jti

        # Force a failure inside UserSessionService.refresh AFTER rotation
        # produced a new pair and the session jtis were re-stamped and saved:
        # the whole rotation must roll back.
        with (
            mock.patch(
                "apps.identity.services.user_session.SessionRefreshed.dispatch",
                side_effect=RuntimeError("boom"),
            ),
            pytest.raises(RuntimeError),
        ):
            TokenService.refresh(
                session=session,
                refresh_token=str(refresh),
            )

        session.refresh_from_db()
        assert session.refresh_token_jti == old_jti
