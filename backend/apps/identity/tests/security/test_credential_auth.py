"""
Credential authentication (WP 7.3-7.6): digest hardening and lazy upgrade,
scope enforcement, owner/expiry/revocation checks, last-used bookkeeping.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.api_keys.hashing import APIKeyHasher, CredentialSecretUnavailable
from apps.identity.models import ApiKey, PersonalAccessToken
from apps.identity.services.credential import (
    API_KEY,
    PERSONAL_ACCESS_TOKEN,
    CredentialService,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions

EVENTS = "api:v1:identity:security-event-list"
HISTORY = "api:v1:identity:login-history-list"
ME = "/api/v1/identity/users/me/"
SEE_EVENTS = "identity.security_event.view"
SEE_HISTORY = "identity.login_history.view"

KINDS = {"pat": (PERSONAL_ACCESS_TOKEN, "Token"), "key": (API_KEY, "Api-Key")}


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(params=["pat", "key"])
def kind(request):
    return request.param


def _holder(*codes):
    user = UserFactory.create()
    grant_permissions(user, *(codes or (SEE_EVENTS, SEE_HISTORY)))
    return user


def _mint(kind, owner, scopes=(SEE_EVENTS,), **extra):
    credential, token = CredentialService.create(
        kind=KINDS[kind][0], owner=owner, name="t", scopes=list(scopes), **extra
    )
    return credential, token


def _legacy(kind, owner, scopes=(), plain="legacyp.secret0123456789abcdef"):
    """A row as it existed before Phase 7: unpeppered digest, free-form scopes."""
    if kind == "pat":
        row = PersonalAccessToken.objects.create(
            user=owner,
            name="old",
            prefix="legacyp",
            hashed_token=APIKeyHasher.legacy_hash(plain),
            scopes=list(scopes),
        )
    else:
        row = ApiKey.objects.create(
            name="old",
            prefix="legacyp",
            hashed_key=APIKeyHasher.legacy_hash(plain),
            owner=owner,
            created_by=owner,
            scopes=list(scopes),
        )
    return row, plain


def _as(kind, secret):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"{KINDS[kind][1]} {secret}")
    return client


def _stored(kind, row):
    row.refresh_from_db()
    return row.hashed_token if kind == "pat" else row.hashed_key


@pytest.mark.django_db
class TestAccountAndCredentialState:
    def test_a_live_credential_works(self, kind):
        _, token = _mint(kind, _holder())

        assert _as(kind, token).get(ME).status_code == 200

    def test_expired_credentials_are_rejected(self, kind):
        credential, token = _mint(kind, _holder())
        type(credential).objects.filter(pk=credential.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        assert _as(kind, token).get(ME).status_code == 401

    def test_a_revoked_row_is_rejected_even_if_it_is_somehow_marked_active(self, kind):
        credential, token = _mint(kind, _holder())
        type(credential).objects.filter(pk=credential.pk).update(
            is_active=True, revoked_at=timezone.now()
        )

        assert _as(kind, token).get(ME).status_code == 401

    def test_inactive_credentials_are_rejected(self, kind):
        credential, token = _mint(kind, _holder())
        type(credential).objects.filter(pk=credential.pk).update(is_active=False)

        assert _as(kind, token).get(ME).status_code == 401

    @pytest.mark.parametrize("field", ["is_active", "is_deleted"])
    def test_a_disabled_or_deleted_owner_is_rejected(self, kind, field):
        owner = _holder()
        _, token = _mint(kind, owner)
        type(owner).objects.filter(pk=owner.pk).update(**{field: field == "is_deleted"})

        assert _as(kind, token).get(ME).status_code in (401, 403)

    @pytest.mark.parametrize("bad", ["", "nodot", "abc.", ".secret", "wrongpre.fix", "x" * 80])
    def test_malformed_and_unknown_secrets_are_rejected(self, kind, bad):
        _mint(kind, _holder())

        assert _as(kind, bad or "-").get(ME).status_code == 401

    def test_the_right_prefix_with_a_wrong_secret_is_rejected(self, kind):
        credential, token = _mint(kind, _holder())

        forged = f"{credential.prefix}.{'z' * 48}"

        assert _as(kind, forged).get(ME).status_code == 401

    def test_two_credentials_sharing_a_prefix_resolve_independently(self, kind):
        owner = _holder()
        first, token_one = _mint(kind, owner)
        shared = first.prefix
        other_plain = f"{shared}.{'q' * 48}"
        if kind == "pat":
            PersonalAccessToken.objects.create(
                user=owner,
                name="twin",
                prefix=shared,
                hashed_token=APIKeyHasher.hash(other_plain),
            )
        else:
            ApiKey.objects.create(
                name="twin",
                prefix=shared,
                hashed_key=APIKeyHasher.hash(other_plain),
                owner=owner,
                created_by=owner,
            )

        assert _as(kind, token_one).get(ME).status_code == 200
        assert _as(kind, other_plain).get(ME).status_code == 200
        assert _as(kind, f"{shared}.{'z' * 48}").get(ME).status_code == 401


@pytest.mark.django_db
class TestOwnerSemantics:
    def test_an_api_key_acts_as_its_owner_not_its_creator(self):
        admin, owner = UserFactory.create(), _holder()
        grant_permissions(owner, SEE_EVENTS)
        key = ApiKey.objects.create(
            name="svc",
            prefix="svcpre01",
            hashed_key=APIKeyHasher.hash("svcpre01.s"),
            owner=owner,
            created_by=admin,
            scopes=[],
        )

        assert _as("key", "svcpre01.s").get(reverse(EVENTS)).status_code == 200
        assert key.principal.pk == owner.pk

    def test_deactivating_the_creator_does_not_suspend_a_key_it_gave_away(self):
        from apps.identity.services.user import UserService

        admin, owner = UserFactory.create(), UserFactory.create()
        ApiKey.objects.create(
            name="svc",
            prefix="svcpre02",
            hashed_key=APIKeyHasher.hash("svcpre02.s"),
            owner=owner,
            created_by=admin,
        )

        UserService.deactivate(instance=admin, user=admin)

        assert ApiKey.objects.get(prefix="svcpre02").is_active is True

        UserService.deactivate(instance=owner, user=admin)

        assert ApiKey.objects.get(prefix="svcpre02").is_active is False


@pytest.mark.django_db
class TestScopeEnforcement:
    def test_a_scoped_credential_reaches_only_its_scopes(self, kind):
        owner = _holder(SEE_EVENTS, SEE_HISTORY)
        _, token = _mint(kind, owner, scopes=[SEE_EVENTS])

        assert _as(kind, token).get(reverse(EVENTS)).status_code == 200
        assert _as(kind, token).get(reverse(HISTORY)).status_code == 403

    def test_the_owner_losing_a_permission_takes_it_from_the_credential(self, kind):
        owner = UserFactory.create()
        role = grant_permissions(owner, SEE_EVENTS)
        _, token = _mint(kind, owner, scopes=[SEE_EVENTS])
        assert _as(kind, token).get(reverse(EVENTS)).status_code == 200

        from apps.identity.services.rbac import RoleService

        RoleService.unassign_user(
            role=role, user=owner, actor=UserFactory.create(is_superuser=True)
        )

        assert _as(kind, token).get(reverse(EVENTS)).status_code == 403

    def test_a_scope_the_owner_never_held_grants_nothing(self, kind):
        owner = UserFactory.create()
        credential, token = _mint(kind, UserFactory.create(is_superuser=True), scopes=[SEE_EVENTS])
        type(credential).objects.filter(pk=credential.pk).update(
            **({"user": owner} if kind == "pat" else {"owner": owner, "created_by": owner})
        )

        assert _as(kind, token).get(reverse(EVENTS)).status_code == 403

    def test_a_scoped_superuser_credential_does_not_inherit_the_bypass(self, kind):
        root = UserFactory.create(is_superuser=True)
        _, token = _mint(kind, root, scopes=[SEE_EVENTS])

        assert _as(kind, token).get(reverse(EVENTS)).status_code == 200
        assert _as(kind, token).get(reverse(HISTORY)).status_code == 403

        session = APIClient()
        session.force_authenticate(user=root)
        assert session.get(reverse(HISTORY)).status_code == 200

    def test_a_legacy_credential_without_scopes_keeps_its_owners_access(self, kind):
        owner = _holder(SEE_EVENTS)
        _, plain = _legacy(kind, owner, scopes=[])

        assert _as(kind, plain).get(reverse(EVENTS)).status_code == 200
        assert _as(kind, plain).get(reverse(HISTORY)).status_code == 403

    def test_old_coarse_scope_labels_grant_nothing(self, kind):
        owner = _holder(SEE_EVENTS)
        _, plain = _legacy(kind, owner, scopes=["read", "write"])

        assert _as(kind, plain).get(reverse(EVENTS)).status_code == 403

    def test_endpoints_that_need_no_permission_stay_open_to_scoped_credentials(self, kind):
        _, token = _mint(kind, _holder(), scopes=[SEE_EVENTS])

        assert _as(kind, token).get(ME).status_code == 200


@pytest.mark.django_db
class TestHashing:
    def test_new_digests_are_peppered_and_verify(self):
        digest = APIKeyHasher.hash("abc.def")

        assert digest.startswith("v2$") and "abc.def" not in digest
        assert APIKeyHasher.verify(plain="abc.def", hashed=digest)
        assert not APIKeyHasher.verify(plain="abc.deg", hashed=digest)

    def test_the_digest_depends_on_the_pepper(self, settings):
        digest = APIKeyHasher.hash("abc.def")
        settings.API_KEY_PEPPER = "a-different-pepper"

        assert APIKeyHasher.hash("abc.def") != digest
        assert not APIKeyHasher.verify(plain="abc.def", hashed=digest)

    def test_without_a_pepper_nothing_is_issued_or_verified(self, settings):
        digest = APIKeyHasher.hash("abc.def")
        settings.API_KEY_PEPPER = ""

        with pytest.raises(CredentialSecretUnavailable):
            APIKeyHasher.hash("abc.def")
        assert not APIKeyHasher.verify(plain="abc.def", hashed=digest)

    def test_creation_over_http_without_a_pepper_is_a_503(self, settings):
        user = _holder()
        settings.API_KEY_PEPPER = ""
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            reverse("api:v1:identity:personal-access-token-list"),
            {"name": "x", "scopes": [SEE_EVENTS]},
            format="json",
        )

        assert response.status_code == 503
        assert not PersonalAccessToken.objects.exists()

    def test_a_legacy_digest_still_works_and_is_upgraded_on_first_use(self, kind):
        row, plain = _legacy(kind, _holder())
        assert not _stored(kind, row).startswith("v2$")

        assert _as(kind, plain).get(ME).status_code == 200

        assert _stored(kind, row).startswith("v2$")
        assert _as(kind, plain).get(ME).status_code == 200

    def test_legacy_digests_can_be_switched_off(self, kind, settings):
        row, plain = _legacy(kind, _holder())
        settings.API_KEY_ACCEPT_LEGACY_HASH = False

        assert _as(kind, plain).get(ME).status_code == 401
        assert not _stored(kind, row).startswith("v2$")

    def test_a_legacy_digest_is_not_upgraded_without_a_pepper(self, kind, settings):
        row, plain = _legacy(kind, _holder())
        settings.API_KEY_PEPPER = ""

        assert _as(kind, plain).get(ME).status_code == 200
        assert not _stored(kind, row).startswith("v2$")

    def test_a_wrong_secret_never_upgrades_anything(self, kind):
        row, _ = _legacy(kind, _holder())

        _as(kind, "legacyp.not-the-secret").get(ME)

        assert not _stored(kind, row).startswith("v2$")


@pytest.mark.django_db
class TestLastUsed:
    def test_use_is_recorded_but_throttled(self, kind):
        credential, token = _mint(kind, _holder())
        client = _as(kind, token)

        client.get(ME, REMOTE_ADDR="198.51.100.9")
        credential.refresh_from_db()
        first = credential.last_used_at

        client.get(ME, REMOTE_ADDR="198.51.100.10")
        credential.refresh_from_db()

        assert first is not None and credential.last_used_ip == "198.51.100.9"
        assert credential.last_used_at == first

    def test_it_is_recorded_again_once_the_window_has_passed(self, kind, settings):
        settings.IDENTITY_CREDENTIAL_TOUCH_SECONDS = 60
        credential, token = _mint(kind, _holder())
        client = _as(kind, token)
        client.get(ME)
        old = timezone.now() - timedelta(minutes=5)
        type(credential).objects.filter(pk=credential.pk).update(last_used_at=old)

        client.get(ME, REMOTE_ADDR="198.51.100.11")
        credential.refresh_from_db()

        assert credential.last_used_at > old
        assert credential.last_used_ip == "198.51.100.11"
