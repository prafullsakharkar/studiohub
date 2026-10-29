"""
API key / PAT lifecycle API (WP 7.1/7.2, API-CRED-01..05).

One-time secret, digest-only storage, owner scoping (IDOR), revocation and
rotation that take effect on the next request.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.choices import SecurityEventType
from apps.identity.models import ApiKey, PersonalAccessToken, SecurityEvent
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions

VIEW = "identity.security_event.view"
USERS_ME = "/api/v1/identity/users/me/"

KINDS = {
    "pat": ("api:v1:identity:personal-access-token", PersonalAccessToken, "Token", "hashed_token"),
    "key": ("api:v1:identity:api-key", ApiKey, "Api-Key", "hashed_key"),
}


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(params=["pat", "key"])
def kind(request):
    return request.param


def _urls(kind):
    base = KINDS[kind][0]
    return reverse(f"{base}-list"), lambda pk: reverse(f"{base}-detail", kwargs={"pk": pk})


def _rotate_url(kind, pk):
    return reverse(f"{KINDS[kind][0]}-rotate", kwargs={"pk": pk})


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _holder(*codes):
    user = UserFactory.create()
    grant_permissions(user, *(codes or (VIEW,)))
    return user


def _create(kind, user, **body):
    body.setdefault("name", "ci")
    body.setdefault("scopes", [VIEW])
    return _client(user).post(_urls(kind)[0], body, format="json")


def _bearer(kind, secret):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"{KINDS[kind][2]} {secret}")
    return client


def _rows(response):
    body = response.json()
    return body if isinstance(body, list) else body.get("results", body)


@pytest.mark.django_db
class TestCreate:
    def test_returns_the_secret_once_and_stores_only_a_digest(self, kind):
        user = _holder()

        response = _create(kind, user)

        body = response.json()
        secret = body["secret"]
        assert response.status_code == 201
        prefix, _, rest = secret.partition(".")
        assert prefix == body["prefix"] and len(rest) >= 32
        row = KINDS[kind][1].objects.get(pk=body["id"])
        stored = getattr(row, KINDS[kind][3])
        assert stored.startswith("v2$") and secret not in stored and rest not in stored

        listing = _client(user).get(_urls(kind)[0])
        detail = _client(user).get(_urls(kind)[1](body["id"]))
        for response in (listing, detail):
            text = response.content.decode()
            assert rest not in text and stored not in text and '"secret"' not in text

    def test_the_new_secret_authenticates_as_its_owner(self, kind):
        user = _holder()
        secret = _create(kind, user).json()["secret"]

        response = _bearer(kind, secret).get(USERS_ME)

        assert response.status_code == 200

    def test_it_is_minted_for_the_caller_only(self, kind):
        user, other = _holder(), _holder()

        body = (
            _client(user)
            .post(
                _urls(kind)[0],
                {"name": "x", "scopes": [VIEW], "owner": str(other.pk), "user": str(other.pk)},
                format="json",
            )
            .json()
        )

        row = KINDS[kind][1].objects.get(pk=body["id"])
        assert row.principal.pk == user.pk

    @pytest.mark.parametrize(
        "body",
        [
            {"scopes": []},
            {"scopes": ["not a code"]},
            {"scopes": ["identity.user.view", "identity.user.view;drop"]},
            {"scopes": ["identity.role.delete"]},  # valid shape, not held by the owner
            {"name": "  "},
            {"name": "x" * 300},
            {"expires_at": "2020-01-01T00:00:00Z"},
        ],
    )
    def test_invalid_requests_are_refused(self, kind, body):
        user = _holder()

        response = _create(kind, user, **body)

        assert response.status_code == 400
        assert not KINDS[kind][1].objects.exists()

    def test_scopes_are_required(self, kind):
        user = _holder()

        response = _client(user).post(_urls(kind)[0], {"name": "no scopes"}, format="json")

        assert response.status_code == 400

    def test_a_superuser_may_scope_any_valid_code(self, kind):
        root = UserFactory.create(is_superuser=True)

        assert _create(kind, root, scopes=["identity.role.delete"]).status_code == 201

    def test_the_per_user_cap(self, kind, settings):
        settings.IDENTITY_MAX_ACTIVE_CREDENTIALS = 2
        user = _holder()

        assert _create(kind, user).status_code == 201
        second = _create(kind, user).json()
        assert _create(kind, user).status_code == 400

        # Revoking frees a slot; rotating never needs one.
        assert _client(user).delete(_urls(kind)[1](second["id"])).status_code == 204
        assert _create(kind, user).status_code == 201

    def test_an_event_is_recorded_without_the_secret(self, kind):
        user = _holder()

        body = _create(kind, user).json()

        events = SecurityEvent.objects.filter(
            user=user, event_type=SecurityEventType.API_KEY_CREATED
        )
        assert events.count() == 1
        blob = f"{events.get().description} {events.get().metadata}"
        assert body["secret"] not in blob and body["secret"].split(".", 1)[1] not in blob


@pytest.mark.django_db
class TestOwnership:
    def test_list_and_retrieve_are_owner_scoped(self, kind):
        mine, theirs = _holder(), _holder()
        own = _create(kind, mine).json()
        foreign = _create(kind, theirs).json()

        listing = _client(mine).get(_urls(kind)[0])

        assert [row["id"] for row in _rows(listing)] == [own["id"]]
        assert _client(mine).get(_urls(kind)[1](foreign["id"])).status_code == 404

    def test_another_users_credential_cannot_be_revoked_or_rotated(self, kind):
        attacker, victim = _holder(), _holder()
        foreign = _create(kind, victim).json()

        assert _client(attacker).delete(_urls(kind)[1](foreign["id"])).status_code == 404
        assert _client(attacker).post(_rotate_url(kind, foreign["id"])).status_code == 404

        assert _bearer(kind, foreign["secret"]).get(USERS_ME).status_code == 200

    def test_a_manager_can_see_and_revoke_but_not_rotate(self, kind):
        victim = _holder()
        manager = _holder("identity.credential.manage")
        foreign = _create(kind, victim).json()
        client = _client(manager)

        assert _rows(client.get(_urls(kind)[0])) == []
        everyone = client.get(_urls(kind)[0], {"all": "true"})
        assert [row["id"] for row in _rows(everyone)] == [foreign["id"]]

        assert client.post(_rotate_url(kind, foreign["id"])).status_code == 403
        assert client.delete(_urls(kind)[1](foreign["id"])).status_code == 204
        assert _bearer(kind, foreign["secret"]).get(USERS_ME).status_code == 401

    def test_anonymous_callers_are_refused(self, kind):
        assert APIClient().get(_urls(kind)[0]).status_code in (401, 403)
        assert APIClient().post(_urls(kind)[0], {}, format="json").status_code in (401, 403)

    def test_a_credential_cannot_manage_credentials(self, kind):
        user = _holder()
        secret = _create(kind, user).json()["secret"]
        client = _bearer(kind, secret)

        assert client.get(_urls(kind)[0]).status_code == 401
        assert (
            client.post(_urls(kind)[0], {"name": "x", "scopes": [VIEW]}, format="json").status_code
            == 401
        )


@pytest.mark.django_db
class TestRevoke:
    def test_revocation_applies_to_the_next_request(self, kind):
        user = _holder()
        body = _create(kind, user).json()
        client = _bearer(kind, body["secret"])
        assert client.get(USERS_ME).status_code == 200

        response = _client(user).delete(_urls(kind)[1](body["id"]))

        assert response.status_code == 204
        assert client.get(USERS_ME).status_code == 401

    def test_revoking_twice_is_harmless_and_audited_once(self, kind):
        user = _holder()
        body = _create(kind, user).json()
        client = _client(user)

        first = client.delete(_urls(kind)[1](body["id"]))
        second = client.delete(_urls(kind)[1](body["id"]) + "?include_revoked=true")

        assert first.status_code == 204
        assert second.status_code == 204
        events = SecurityEvent.objects.filter(
            user=user, event_type=SecurityEventType.API_KEY_REVOKED
        )
        assert events.count() == 1

    def test_revoked_credentials_are_hidden_unless_asked_for(self, kind):
        user = _holder()
        body = _create(kind, user).json()
        _client(user).delete(_urls(kind)[1](body["id"]))

        default = _client(user).get(_urls(kind)[0])
        everything = _client(user).get(_urls(kind)[0], {"include_revoked": "true"})

        assert _rows(default) == []
        row = _rows(everything)[0]
        assert row["is_active"] is False and row["revoked_at"] is not None

    def test_a_revoked_credential_stays_revoked_when_the_account_is_reactivated(self, kind):
        from apps.identity.services.user import UserService

        user = _holder()
        revoked = _create(kind, user).json()
        kept = _create(kind, user).json()
        _client(user).delete(_urls(kind)[1](revoked["id"]))

        UserService.deactivate(instance=user, user=user)
        UserService.activate(instance=user, user=user)

        model = KINDS[kind][1]
        assert model.objects.get(pk=revoked["id"]).is_active is False
        assert model.objects.get(pk=kept["id"]).is_active is True
        assert _bearer(kind, revoked["secret"]).get(USERS_ME).status_code == 401
        assert _bearer(kind, kept["secret"]).get(USERS_ME).status_code == 200


@pytest.mark.django_db
class TestRotate:
    def test_the_old_secret_dies_and_the_new_one_works_at_once(self, kind):
        user = _holder()
        old = _create(kind, user, name="deploy").json()

        response = _client(user).post(_rotate_url(kind, old["id"]))

        new = response.json()
        assert response.status_code == 200
        assert new["secret"] != old["secret"] and new["id"] != old["id"]
        assert new["name"] == "deploy" and new["scopes"] == [VIEW]
        assert _bearer(kind, old["secret"]).get(USERS_ME).status_code == 401
        assert _bearer(kind, new["secret"]).get(USERS_ME).status_code == 200

    def test_rotation_is_audited_as_a_create_and_a_revoke(self, kind):
        user = _holder()
        old = _create(kind, user).json()

        _client(user).post(_rotate_url(kind, old["id"]))

        assert (
            SecurityEvent.objects.filter(
                user=user, event_type=SecurityEventType.API_KEY_CREATED
            ).count()
            == 2
        )
        revoked = SecurityEvent.objects.get(user=user, event_type=SecurityEventType.API_KEY_REVOKED)
        assert revoked.metadata["reason"] == "rotated"

    def test_a_revoked_credential_cannot_be_rotated(self, kind):
        user = _holder()
        old = _create(kind, user).json()
        _client(user).delete(_urls(kind)[1](old["id"]))

        response = _client(user).post(_rotate_url(kind, old["id"]) + "?include_revoked=true")

        assert response.status_code in (400, 404)

    def test_rotating_keeps_the_expiry(self, kind):
        user = _holder()
        expiry = (timezone.now() + timedelta(days=30)).replace(microsecond=0)
        old = _create(kind, user, expires_at=expiry.isoformat()).json()

        new = _client(user).post(_rotate_url(kind, old["id"])).json()

        assert new["expires_at"] == old["expires_at"]
