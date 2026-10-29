from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.services.user_session import UserSessionService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestRollingSessionExpiry:
    def test_refresh_extends_expiry_within_absolute_cap(self):
        user = UserFactory.create(is_active=True)
        session = UserSession.objects.create(
            user=user,
            session_key="s1",
            refresh_token_jti="r1",
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            expires_at=timezone.now() - timedelta(days=1),
        )

        UserSessionService.refresh(
            session,
            access_token_jti="a2",
            refresh_token_jti="r2",
        )

        session.refresh_from_db()
        # refresh tokens last 7 days (config/settings/components/jwt.py)
        assert session.expires_at > timezone.now() + timedelta(days=6)

    def test_absolute_cap_never_exceeded(self):
        user = UserFactory.create(is_active=True)
        session = UserSession.objects.create(
            user=user,
            session_key="s2",
            refresh_token_jti="r1",
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            expires_at=timezone.now() + timedelta(days=1),
        )
        # created_at is auto_now_add, so it can only be moved afterwards
        UserSession.objects.filter(pk=session.pk).update(
            created_at=timezone.now() - timedelta(days=29)
        )
        session.refresh_from_db()

        UserSessionService.refresh(
            session,
            access_token_jti="a2",
            refresh_token_jti="r2",
        )

        session.refresh_from_db()
        # the absolute cap is 30 days from the session's start, not 7 more days
        assert session.expires_at <= timezone.now() + timedelta(days=1, minutes=1)
