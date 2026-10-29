from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.api_keys.hashing import APIKeyHasher
from apps.identity.choices import SessionStatus
from apps.identity.models import ApiKey, PersonalAccessToken, UserSession
from apps.identity.services.user import UserService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestDeactivationSuspendsCredentials:
    def _make_creds(self, user):
        PersonalAccessToken.objects.create(
            user=user,
            name="pat",
            prefix="pa",
            hashed_token=APIKeyHasher.hash("pat.secret"),
            is_active=True,
        )
        ApiKey.objects.create(
            name="key",
            prefix="ka",
            hashed_key=APIKeyHasher.hash("key.secret"),
            created_by=user,
            is_active=True,
        )

    def test_deactivate_revokes_sessions_and_suspends_credentials(self):
        user = UserFactory.create(is_active=True)
        self._make_creds(user)
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            expires_at=timezone.now() + timedelta(days=1),
        )

        UserService.deactivate(instance=user, user=user)

        user.refresh_from_db()
        assert user.is_active is False
        assert not UserSession.objects.active().by_user(user).exists()
        assert PersonalAccessToken.objects.get(user=user).is_active is False
        assert ApiKey.objects.get(created_by=user).is_active is False

    def test_activate_restores_credentials(self):
        user = UserFactory.create(is_active=False)
        self._make_creds(user)
        # suspended
        PersonalAccessToken.objects.filter(user=user).update(is_active=False)
        ApiKey.objects.filter(created_by=user).update(is_active=False)

        UserService.activate(instance=user, user=user)

        user.refresh_from_db()
        assert user.is_active is True
        assert PersonalAccessToken.objects.get(user=user).is_active is True
        assert ApiKey.objects.get(created_by=user).is_active is True
