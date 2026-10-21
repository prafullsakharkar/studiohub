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
        assert session.expires_at > timezone.now() + timedelta(days=20)

    def test_absolute_cap_never_exceeded(self):
        user = UserFactory.create(is_active=True)
        session = UserSession.objects.create(
            user=user,
            session_key="s2",
            refresh_token_jti="r1",
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            created_at=timezone.now() - timedelta(days=85),
            expires_at=timezone.now() + timedelta(days=1),
        )

        UserSessionService.refresh(
            session,
            access_token_jti="a2",
            refresh_token_jti="r2",
        )

        session.refresh_from_db()
        assert session.expires_at <= timezone.now() + timedelta(days=90)
