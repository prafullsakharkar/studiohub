"""
Session revocation with real authentication (WP 5.2 / 5.3).

Every test logs in through the public endpoint and uses the issued bearer
token, so the whole chain is exercised: JWT -> session-bound authenticator ->
session status cache -> UserSession row.
"""

from __future__ import annotations

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.choices import SecurityEventType, SessionStatus
from apps.identity.models import (
    ApiKey,
    PersonalAccessToken,
    SecurityEvent,
    UserSession,
)
from apps.identity.services.user import UserService
from apps.identity.services.user_session import UserSessionService
from apps.identity.tests.factories import UserFactory

PASSWORD = "S3cure-pass-phrase!"


def _user():
    user = UserFactory.create(is_email_verified=True)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _login(user):
    client = APIClient()
    response = client.post(
        reverse("api:v1:auth-compat:auth-login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 200, response.data
    tokens = response.data["tokens"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client, tokens


def _me(client):
    return client.get(reverse("api:v1:auth-compat:auth-me"))


def _session(user):
    return UserSession.objects.filter(user=user).latest("created_at")


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestImmediateRevocation:
    def test_access_token_works_before_revocation(self):
        client, _ = _login(_user())

        assert _me(client).status_code == 200

    def test_revoke_mid_use_rejects_the_next_request(self):
        user = _user()
        client, _ = _login(user)
        assert _me(client).status_code == 200  # primes the status snapshot

        UserSessionService.revoke(_session(user))

        assert _me(client).status_code == 401

    def test_logout_mid_use_rejects_the_next_request(self):
        user = _user()
        client, tokens = _login(user)
        assert _me(client).status_code == 200

        response = client.post(
            reverse("api:v1:auth-compat:auth-logout"),
            {"refresh": tokens["refresh"]},
            format="json",
        )

        assert response.status_code == 200
        assert _me(client).status_code == 401

    def test_expired_session_is_rejected(self):
        user = _user()
        client, _ = _login(user)
        assert _me(client).status_code == 200

        UserSessionService.expire(_session(user))

        assert _me(client).status_code == 401

    def test_logout_all_rejects_every_device_immediately(self):
        user = _user()
        first, _ = _login(user)
        second, _ = _login(user)
        assert _me(first).status_code == 200
        assert _me(second).status_code == 200

        UserSessionService.logout_all(user=user)

        assert _me(first).status_code == 401
        assert _me(second).status_code == 401

    def test_logout_other_devices_keeps_only_the_current_one(self):
        user = _user()
        keep, _ = _login(user)
        drop, _ = _login(user)
        assert _me(keep).status_code == 200
        assert _me(drop).status_code == 200
        current = UserSession.objects.filter(user=user).earliest("created_at")

        UserSessionService.logout_other_devices(current_session=current)

        assert _me(keep).status_code == 200
        assert _me(drop).status_code == 401


@pytest.mark.django_db
class TestRefreshTokensAreBlacklistedOnClose:
    """logout_all / logout_other_devices / revoke blacklist refresh tokens too."""

    def _refresh(self, tokens):
        return APIClient().post(
            reverse("api:v1:auth-compat:auth-refresh"),
            {"refresh": tokens["refresh"]},
            format="json",
        )

    def test_refresh_fails_after_logout_all(self):
        user = _user()
        _, tokens = _login(user)

        UserSessionService.logout_all(user=user)

        assert self._refresh(tokens).status_code == 401

    def test_refresh_fails_after_revoke(self):
        user = _user()
        _, tokens = _login(user)

        UserSessionService.revoke(_session(user))

        assert self._refresh(tokens).status_code == 401

    def test_refresh_fails_for_logged_out_other_device(self):
        user = _user()
        _, kept = _login(user)
        _, dropped = _login(user)
        current = UserSession.objects.filter(user=user).earliest("created_at")

        UserSessionService.logout_other_devices(current_session=current)

        assert self._refresh(dropped).status_code == 401
        assert self._refresh(kept).status_code == 200

    @pytest.mark.parametrize("how", ["logout_all", "revoke", "logout_other"])
    def test_refresh_jti_lands_in_the_blacklist(self, how):
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
        )

        user = _user()
        _login(user)
        _login(user)
        target = UserSession.objects.filter(user=user).latest("created_at")
        keep = UserSession.objects.filter(user=user).earliest("created_at")

        if how == "logout_all":
            UserSessionService.logout_all(user=user)
        elif how == "revoke":
            UserSessionService.revoke(target)
        else:
            UserSessionService.logout_other_devices(current_session=keep)

        assert BlacklistedToken.objects.filter(token__jti=target.refresh_token_jti).exists()

    def test_refresh_still_works_for_untouched_session(self):
        _, tokens = _login(_user())

        assert self._refresh(tokens).status_code == 200


@pytest.mark.django_db
class TestDeactivationCascade:
    def test_deactivate_stops_every_credential_at_once(self):
        user = _user()
        client, tokens = _login(user)
        assert _me(client).status_code == 200
        pat = PersonalAccessToken.objects.create(
            user=user, name="t", prefix="pa", hashed_token="h" * 64
        )
        key = ApiKey.objects.create(name="k", prefix="ka", hashed_key="k" * 64, created_by=user)

        UserService.deactivate(user)

        assert _me(client).status_code == 401
        assert (
            APIClient()
            .post(
                reverse("api:v1:auth-compat:auth-refresh"),
                {"refresh": tokens["refresh"]},
                format="json",
            )
            .status_code
            == 401
        )
        assert not UserSession.objects.filter(user=user, status=SessionStatus.ACTIVE).exists()
        pat.refresh_from_db()
        key.refresh_from_db()
        assert pat.is_active is False
        assert key.is_active is False
        assert SecurityEvent.objects.filter(
            user=user, event_type=SecurityEventType.ACCOUNT_DEACTIVATED
        ).exists()

    def test_archive_runs_the_same_cascade(self):
        user = _user()
        client, _ = _login(user)
        assert _me(client).status_code == 200

        UserService.archive(user)

        assert _me(client).status_code == 401

    def test_partial_cascade_rolls_back(self, monkeypatch):
        user = _user()
        client, _ = _login(user)
        assert _me(client).status_code == 200

        from apps.identity.services import security_event as module

        def boom(*args, **kwargs):
            raise RuntimeError("audit store down")

        monkeypatch.setattr(module.SecurityEventService, "create", boom)

        with pytest.raises(RuntimeError):
            UserService.deactivate(user)

        user.refresh_from_db()
        assert user.is_active is True
        assert UserSession.objects.filter(user=user, status=SessionStatus.ACTIVE).exists()
        assert _me(client).status_code == 200
