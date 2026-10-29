from __future__ import annotations

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.choices import SecurityEventType, SessionStatus
from apps.identity.models import SecurityEvent, UserSession
from apps.identity.services.user import UserService
from apps.identity.services.user_password import UserPasswordService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestAdminPasswordPaths:
    def test_weak_password_rejected_on_admin_change(self):
        from django.core.exceptions import ValidationError

        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])

        with pytest.raises(ValidationError):
            UserPasswordService.change_password(user=user, password="weak")

    def test_admin_reset_sets_flag_revokes_and_events(self):
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

        UserService.reset_password(instance=user, user=user)

        assert not UserSession.objects.active().by_user(user).exists()
        user.refresh_from_db()
        profile = user.profile
        assert profile.must_change_password is True
        assert SecurityEvent.objects.filter(
            user=user,
            event_type=SecurityEventType.PASSWORD_RESET,
        ).exists()
