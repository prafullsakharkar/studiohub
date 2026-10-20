from __future__ import annotations

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.choices import SecurityEventType, SessionStatus
from apps.identity.models import SecurityEvent, UserSession
from apps.identity.services.password import PasswordService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestPasswordChangeRevokes:
    def test_change_password_revokes_sessions_and_records_event(self):
        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
            expires_at=JWTService.get_expiration(refresh),
        )

        PasswordService.change_password(
            user=user,
            old_password="old-pass-1",
            new_password="new-pass-1",
        )

        assert not UserSession.objects.active().by_user(user).exists()
        event = SecurityEvent.objects.filter(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
        ).first()
        assert event is not None
        assert user.check_password("new-pass-1")

    def test_change_password_rejects_wrong_old_password(self):
        # PasswordService raises the core exception class (not the identity
        # one) — import from the same module the service uses.
        from apps.core.api.exceptions.authentication import InvalidCredentials

        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])

        with pytest.raises(InvalidCredentials):
            PasswordService.change_password(
                user=user,
                old_password="wrong",
                new_password="new-pass-1",
            )
