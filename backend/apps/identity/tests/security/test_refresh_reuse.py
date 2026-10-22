"""
Refresh-token reuse detection (Phase 5 session tests) and privilege changes
reaching live sessions (WP 5.12).

A rotated refresh token that is presented again revokes its whole session.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.choices import SecurityEventType, SessionStatus
from apps.identity.models import Role, SecurityEvent, UserSession
from apps.identity.services.rbac import RoleService
from apps.identity.services.user_session import UserSessionService
from apps.identity.tests.factories import UserFactory, UserSessionFactory
from apps.identity.tests.rbac_helpers import ensure_permission, grant_permissions

PASSWORD = "Correct-horse-battery-9!"
LOGIN = "api:v1:auth-compat:auth-login"
REFRESH = "api:v1:auth-compat:auth-refresh"
ME = "api:v1:auth-compat:auth-me"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def _user():
    user = UserFactory.create(is_email_verified=True)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _login(user):
    response = APIClient().post(
        reverse(LOGIN),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 200, response.data
    return response.json()["tokens"]


def _refresh(refresh):
    return APIClient().post(reverse(REFRESH), {"refresh": refresh}, format="json")


def _me(access):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client.get(reverse(ME))


def _sid(token):
    return token_backend.decode(token, verify=True).get("sid")


def _suspicious(user):
    return SecurityEvent.objects.filter(user=user, event_type=SecurityEventType.SUSPICIOUS_ACTIVITY)


@pytest.mark.django_db
class TestSessionIdentityClaim:
    def test_first_token_names_its_own_session(self):
        user = _user()
        tokens = _login(user)

        session = UserSession.objects.get(user=user)

        assert _sid(tokens["refresh"]) == session.session_key

    def test_rotation_keeps_the_same_session_identity(self):
        user = _user()
        tokens = _login(user)
        session = UserSession.objects.get(user=user)

        first = _refresh(tokens["refresh"]).json()
        second = _refresh(first["refresh"]).json()

        assert _sid(first["refresh"]) == session.session_key
        assert _sid(second["refresh"]) == session.session_key
        assert first["refresh"] != second["refresh"]


@pytest.mark.django_db
class TestReuseRevokesTheSession:
    def test_replaying_a_rotated_token_revokes_the_session(self):
        user = _user()
        original = _login(user)
        rotated = _refresh(original["refresh"]).json()
        assert _me(rotated["access"]).status_code == 200

        replay = _refresh(original["refresh"])

        assert replay.status_code == 401
        session = UserSession.objects.get(user=user)
        assert session.status == SessionStatus.REVOKED

    def test_the_rotated_tokens_stop_working_immediately(self):
        user = _user()
        original = _login(user)
        rotated = _refresh(original["refresh"]).json()
        assert _me(rotated["access"]).status_code == 200  # primes the status cache

        _refresh(original["refresh"])  # the replay

        assert _me(rotated["access"]).status_code == 401
        assert _refresh(rotated["refresh"]).status_code == 401

    def test_reuse_is_recorded_as_suspicious_activity(self):
        user = _user()
        original = _login(user)
        _refresh(original["refresh"])

        _refresh(original["refresh"])

        assert _suspicious(user).count() == 1

    def test_only_the_replayed_session_is_revoked(self):
        user = _user()
        stolen_family = _login(user)
        other_device = _login(user)
        _refresh(stolen_family["refresh"])

        _refresh(stolen_family["refresh"])

        assert _me(other_device["access"]).status_code == 200
        revoked = UserSession.objects.filter(user=user, status=SessionStatus.REVOKED)
        assert revoked.count() == 1

    def test_a_token_from_a_logged_out_session_is_just_stale(self):
        user = _user()
        tokens = _login(user)
        UserSessionService.logout(UserSession.objects.get(user=user))

        replay = _refresh(tokens["refresh"])

        assert replay.status_code == 401
        assert not _suspicious(user).exists()

    def test_a_forged_token_cannot_revoke_someone_elses_session(self):
        victim = _user()
        victim_tokens = _login(victim)
        victim_session = UserSession.objects.get(user=victim)
        attacker = _user()
        attacker_tokens = _login(attacker)
        _refresh(attacker_tokens["refresh"])

        # The attacker replays their own rotated token but swaps the payload's
        # session id for the victim's. The signature no longer verifies.
        header, payload, signature = attacker_tokens["refresh"].split(".")
        import base64
        import json

        body = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        body["sid"] = victim_session.session_key
        forged_payload = base64.urlsafe_b64encode(json.dumps(body).encode()).rstrip(b"=").decode()
        forged = ".".join([header, forged_payload, signature])

        assert _refresh(forged).status_code == 401

        victim_session.refresh_from_db()
        assert victim_session.status == SessionStatus.ACTIVE
        assert _me(victim_tokens["access"]).status_code == 200

    def test_the_legitimate_chain_is_unaffected_until_a_replay(self):
        user = _user()
        tokens = _login(user)

        for _ in range(3):
            tokens = _refresh(tokens["refresh"]).json()

        assert _me(tokens["access"]).status_code == 200
        assert not _suspicious(user).exists()


@pytest.mark.django_db
class TestTokensIssuedBeforeTheClaimExisted:
    def _legacy_session(self):
        user = _user()
        refresh = RefreshToken.for_user(user)  # no ``sid`` claim
        assert "sid" not in refresh.payload
        UserSessionFactory.create(
            user=user,
            session_key=str(refresh["jti"]),
            refresh_token_jti=str(refresh["jti"]),
            access_token_jti=str(refresh.access_token["jti"]),
            status=SessionStatus.ACTIVE,
            expires_at=timezone.now() + timedelta(days=1),
        )
        return user, str(refresh)

    def test_rotation_adds_the_claim_from_the_session_row(self):
        user, legacy = self._legacy_session()
        session = UserSession.objects.get(user=user)

        rotated = _refresh(legacy)

        assert rotated.status_code == 200
        assert _sid(rotated.json()["refresh"]) == session.session_key

    def test_replaying_a_legacy_token_is_rejected_but_cannot_name_a_session(self):
        user, legacy = self._legacy_session()
        _refresh(legacy)

        assert _refresh(legacy).status_code == 401

        # Transitional limit: a pre-claim token carries no sid, so it cannot
        # name a session. The replay is rejected; the rotated family (which now
        # carries the claim) stays usable and protected from here on.
        assert UserSession.objects.get(user=user).status == SessionStatus.ACTIVE


@pytest.mark.django_db
class TestPrivilegeChangesReachLiveSessions:
    """WP 5.12: permissions are resolved per request, not baked into tokens."""

    def _setup(self):
        admin = UserFactory.create(is_superuser=True)
        user = _user()
        tokens = _login(user)
        permission = ensure_permission("identity.security_event.view")
        role = Role.objects.create(name="Event Viewers", code="event-viewers")
        grant_permissions(admin, permission.code)
        RoleService.grant_permission(role=role, permission=permission, actor=admin)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        return admin, user, role, client

    def test_granting_and_revoking_a_role_changes_the_next_request(self):
        admin, user, role, client = self._setup()
        url = reverse("api:v1:identity:security-event-list")
        assert client.get(url).status_code == 403

        RoleService.assign_user(role=role, user=user, actor=admin)
        assert client.get(url).status_code == 200

        RoleService.unassign_user(role=role, user=user, actor=admin)
        assert client.get(url).status_code == 403

    def test_the_session_itself_is_unaffected(self):
        admin, user, role, client = self._setup()

        RoleService.assign_user(role=role, user=user, actor=admin)
        RoleService.unassign_user(role=role, user=user, actor=admin)

        assert UserSession.objects.get(user=user).status == SessionStatus.ACTIVE
        assert client.get(reverse(ME)).status_code == 200
