"""
End-to-end identity journeys over the real HTTP API (WP 8.1, 8.2).

No ``force_authenticate``: every call carries the tokens or credentials the
previous step returned. Only the operator account is created out of band.
"""

from __future__ import annotations

import time

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.authentication.totp import TOTPService
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory

PASSWORD = "Correct-horse-battery-9!"
OPERATOR_PASSWORD = "Operator-horse-battery-9!"

LOGIN = "api:v1:auth-compat:auth-login"
CHALLENGE = "api:v1:auth-compat:auth-mfa-challenge"
REFRESH = "api:v1:auth-compat:auth-refresh"
LOGOUT = "api:v1:auth-compat:auth-logout"
ME = "api:v1:auth-compat:auth-me"
CRED_ME = "/api/v1/identity/users/me/"
SETUP = "api:v1:identity:mfa-totp-setup"
ENABLE = "api:v1:identity:mfa-totp-enable"
PATS = "api:v1:identity:personal-access-token-list"
KEYS = "api:v1:identity:api-key-list"
USERS = "api:v1:identity:user-list"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _operator_needs_no_mfa(monkeypatch):
    """These journeys are about the *user's* MFA; the operator signs in with a password only."""
    from apps.identity.services.mfa import MFAPolicyService

    monkeypatch.setattr(MFAPolicyService, "REQUIRE_STAFF_MFA", False)
    monkeypatch.setattr(MFAPolicyService, "REQUIRE_SUPERUSER_MFA", False)


def _client(scheme=None, token=None):
    client = APIClient()
    if token:
        client.credentials(HTTP_AUTHORIZATION=f"{scheme} {token}")
    return client


def _login(email, password):
    return APIClient().post(reverse(LOGIN), {"email": email, "password": password}, format="json")


def _operator():
    operator = UserFactory.create(is_staff=True, is_superuser=True, is_email_verified=True)
    operator.set_password(OPERATOR_PASSWORD)
    operator.save(update_fields=["password"])
    tokens = _login(operator.email, OPERATOR_PASSWORD).json()["tokens"]
    return operator, _client("Bearer", tokens["access"])


def _create_user(operator_client, email="journey@example.com"):
    response = operator_client.post(
        reverse(USERS),
        {"email": email, "password": PASSWORD, "is_active": True},
        format="json",
    )
    assert response.status_code == 201, response.content
    return response.json().get("id") or response.json()["data"]["id"]


@pytest.mark.django_db
class TestJourney:
    def test_create_login_mfa_credential_use_revoke(self):
        _, operator = _operator()
        email = "journey@example.com"
        user_id = _create_user(operator, email)

        # 1. the new user signs in with a password
        first = _login(email, PASSWORD)
        assert first.status_code == 200, first.content
        access = first.json()["tokens"]["access"]
        member = _client("Bearer", access)
        assert member.get(reverse(ME)).status_code == 200

        # 2. enrols MFA: server-held secret, activated by a code
        secret = member.get(reverse(SETUP)).json()["secret"]
        enabled = member.post(
            reverse(ENABLE), {"code": TOTPService.current_code(secret)}, format="json"
        )
        assert enabled.status_code == 200 and len(enabled.json()["recovery_codes"]) == 10

        # 3. logs out: that access token is dead on the next request
        refresh = first.json()["tokens"]["refresh"]
        out = member.post(reverse(LOGOUT), {"refresh": refresh}, format="json")
        assert out.status_code == 200
        assert member.get(reverse(ME)).status_code == 401

        # 4. password alone no longer signs in
        again = _login(email, PASSWORD).json()
        assert again["mfa_required"] is True and "tokens" not in again

        # 5. challenge + a code from the next time step completes the login
        next_code = TOTPService.at(secret=secret, timestamp=int(time.time()) + 30)
        done = APIClient().post(
            reverse(CHALLENGE),
            {"challenge": again["challenge"], "code": next_code},
            format="json",
        )
        assert done.status_code == 200, done.content
        member = _client("Bearer", done.json()["tokens"]["access"])
        assert member.get(reverse(ME)).status_code == 200

        # 6. mints a PAT and an API key, uses both
        pat = member.post(
            reverse(PATS),
            {"name": "ci", "scopes": ["identity.user.view"]},
            format="json",
        )
        # a plain user holds no permissions, so scoping to one is refused
        assert pat.status_code == 400

        root_pat = operator.post(
            reverse(PATS), {"name": "ci", "scopes": ["identity.user.view"]}, format="json"
        )
        assert root_pat.status_code == 201
        pat_secret = root_pat.json()["secret"]
        assert _client("Token", pat_secret).get(CRED_ME).status_code == 200

        # 7. revokes it: rejected on the very next request
        revoked = operator.delete(
            reverse(
                "api:v1:identity:personal-access-token-detail", kwargs={"pk": root_pat.json()["id"]}
            )
        )
        assert revoked.status_code == 204
        assert _client("Token", pat_secret).get(CRED_ME).status_code == 401

        assert UserSession.objects.filter(user_id=user_id).count() == 2

    def test_a_wrong_password_and_a_wrong_code_never_sign_anyone_in(self):
        _, operator = _operator()
        email = "journey2@example.com"
        _create_user(operator, email)
        member = _client("Bearer", _login(email, PASSWORD).json()["tokens"]["access"])
        secret = member.get(reverse(SETUP)).json()["secret"]
        member.post(reverse(ENABLE), {"code": TOTPService.current_code(secret)}, format="json")

        assert _login(email, "Wrong-password-1!").status_code == 401

        challenge = _login(email, PASSWORD).json()["challenge"]
        bad = APIClient().post(
            reverse(CHALLENGE), {"challenge": challenge, "code": "000000"}, format="json"
        )

        assert bad.status_code == 401 and "tokens" not in bad.json()


@pytest.mark.django_db
class TestDeactivationCascade:
    """WP 8.2: every way of being signed in stops at once, and stays stopped."""

    def _signed_in_everywhere(self, operator, email):
        user_id = _create_user(operator, email)
        # two sessions: one whose access token is held, one whose refresh
        # token is held and deliberately never used before the deactivation
        tokens = _login(email, PASSWORD).json()["tokens"]
        spare = _login(email, PASSWORD).json()["tokens"]
        member = _client("Bearer", tokens["access"])

        # a PAT and API keys, minted by the user through the API; give the
        # user a permission first so they may scope something.
        from apps.identity.models import User
        from apps.identity.tests.rbac_helpers import grant_permissions

        grant_permissions(User.objects.get(pk=user_id), "identity.security_event.view")
        scope = ["identity.security_event.view"]
        pat = member.post(reverse(PATS), {"name": "p", "scopes": scope}, format="json").json()
        key = member.post(reverse(KEYS), {"name": "k", "scopes": scope}, format="json").json()
        revoked = member.post(
            reverse(KEYS), {"name": "gone", "scopes": scope}, format="json"
        ).json()
        member.delete(reverse("api:v1:identity:api-key-detail", kwargs={"pk": revoked["id"]}))
        return user_id, {**tokens, "refresh": spare["refresh"]}, pat, key, revoked

    def _statuses(self, tokens, pat, key, revoked):
        return {
            "access": _client("Bearer", tokens["access"]).get(reverse(ME)).status_code,
            "refresh": APIClient()
            .post(reverse(REFRESH), {"refresh": tokens["refresh"]}, format="json")
            .status_code,
            "pat": _client("Token", pat["secret"]).get(CRED_ME).status_code,
            "key": _client("Api-Key", key["secret"]).get(CRED_ME).status_code,
            "revoked_key": _client("Api-Key", revoked["secret"]).get(CRED_ME).status_code,
        }

    def test_everything_works_then_stops_then_only_credentials_return(self):
        _, operator = _operator()
        email = "cascade@example.com"
        user_id, tokens, pat, key, revoked = self._signed_in_everywhere(operator, email)

        member = _client("Bearer", tokens["access"])
        assert member.get(reverse(ME)).status_code == 200
        assert _client("Token", pat["secret"]).get(CRED_ME).status_code == 200
        assert _client("Api-Key", key["secret"]).get(CRED_ME).status_code == 200
        assert _client("Api-Key", revoked["secret"]).get(CRED_ME).status_code == 401
        # a refresh token of this account is usable while it is active
        probe = _login(email, PASSWORD).json()["tokens"]["refresh"]
        assert (
            APIClient().post(reverse(REFRESH), {"refresh": probe}, format="json").status_code == 200
        )

        stop = operator.post(reverse("api:v1:identity:user-deactivate", kwargs={"pk": user_id}))
        assert stop.status_code == 200, stop.content

        after = self._statuses(tokens, pat, key, revoked)
        assert set(after.values()) == {401}, after
        assert _login(email, PASSWORD).status_code == 401
        assert not UserSession.objects.active().filter(user_id=user_id).exists()

        start = operator.post(reverse("api:v1:identity:user-activate", kwargs={"pk": user_id}))
        assert start.status_code == 200, start.content

        restored = self._statuses(tokens, pat, key, revoked)
        # sessions and their tokens never come back; suspended credentials do;
        # a deliberately revoked one stays revoked.
        assert (restored["access"], restored["refresh"]) == (401, 401), restored
        assert restored["pat"] == 200 and restored["key"] == 200
        assert restored["revoked_key"] == 401
        assert _login(email, PASSWORD).status_code == 200


@pytest.mark.django_db
class TestRotatedAccessTokens:
    """Found by the cascade proof: a rotated-out access token kept a cached
    "active" snapshot, so it could outlive a logout or deactivation by up to
    the snapshot TTL (and return when the account was re-activated)."""

    def _setup(self):
        _, operator = _operator()
        email = "rotate@example.com"
        user_id = _create_user(operator, email)
        tokens = _login(email, PASSWORD).json()["tokens"]
        return operator, user_id, email, tokens

    def test_the_replaced_access_token_stops_working_at_once(self):
        _, _, _, tokens = self._setup()
        old = _client("Bearer", tokens["access"])
        assert old.get(reverse(ME)).status_code == 200  # caches the snapshot

        rotated = APIClient().post(reverse(REFRESH), {"refresh": tokens["refresh"]}, format="json")

        assert rotated.status_code == 200
        assert old.get(reverse(ME)).status_code == 401
        assert _client("Bearer", rotated.json()["access"]).get(reverse(ME)).status_code == 200

    def test_a_replaced_access_token_does_not_return_with_the_account(self):
        operator, user_id, _, tokens = self._setup()
        old = _client("Bearer", tokens["access"])
        old.get(reverse(ME))
        rotated = APIClient().post(reverse(REFRESH), {"refresh": tokens["refresh"]}, format="json")
        new = _client("Bearer", rotated.json()["access"])
        assert new.get(reverse(ME)).status_code == 200

        operator.post(reverse("api:v1:identity:user-deactivate", kwargs={"pk": user_id}))
        operator.post(reverse("api:v1:identity:user-activate", kwargs={"pk": user_id}))

        assert old.get(reverse(ME)).status_code == 401
        assert new.get(reverse(ME)).status_code == 401
