"""
A scoped API key / PAT does only what its scopes list (TPN review TM-013, DOM-CRED-04).

The owner here holds every permission, so any success below is down to the credential's own limit.
Two doors used to stay open: actions with an empty permission tuple ("any signed-in user") and views
that check no permission code at all (attachments, tags, analytics).
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.api_keys.hashing import APIKeyHasher
from apps.identity.models import ApiKey, PersonalAccessToken
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes

ME = "/api/v1/identity/users/me/"
USERS = "/api/v1/identity/users/"
FLAGS = "/api/v1/settings/feature-flags/"
STATUSES = "/api/v1/platform/master-data/statuses"

# Open to every signed-in user, and not to a scoped credential
OPEN_BUT_ACCOUNT_LEVEL = (
    "/api/v1/identity/profiles/",
    "/api/v1/identity/sessions/",
    "/api/v1/identity/trusted-devices/",
    "/api/v1/roles/",
    "/api/v1/groups/",
    "/api/v1/permissions/",
    "/api/v1/people/",
)

# Views that check no permission code
NO_CODE_VIEWS = (
    "/api/v1/core/attachments/",
    "/api/v1/attachments/",
    "/api/v1/core/tags/",
    "/api/v1/analytics/kpis/",
)


def _owner():
    owner = UserFactory.create(is_active=True)
    grant_all_known_codes(owner)
    return owner


def _client(owner, *, key: bool, scopes):
    plain = f"gate{'k' if key else 't'}.secr1234567890abcdef"

    if key:
        ApiKey.objects.create(
            name="gate key",
            prefix=plain.split(".", 1)[0],
            hashed_key=APIKeyHasher.hash(plain),
            created_by=owner,
            scopes=scopes,
            is_active=True,
        )
        header = f"Api-Key {plain}"
    else:
        PersonalAccessToken.objects.create(
            user=owner,
            name="gate token",
            prefix=plain.split(".", 1)[0],
            hashed_token=APIKeyHasher.hash(plain),
            scopes=scopes,
            is_active=True,
        )
        header = f"Token {plain}"

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=header)
    return client


@pytest.fixture(params=["token", "key"])
def kind(request):
    return request.param == "key"


@pytest.mark.django_db
class TestScopedCredentialsStayInTheirScopes:
    def test_the_listed_scope_works(self, kind):
        client = _client(_owner(), key=kind, scopes=["identity.user.view"])

        assert client.get(USERS).status_code == 200

    def test_it_can_still_ask_who_it_is(self, kind):
        client = _client(_owner(), key=kind, scopes=["identity.user.view"])

        assert client.get(ME).status_code == 200

    def test_reference_data_stays_readable(self, kind):
        client = _client(_owner(), key=kind, scopes=["identity.user.view"])

        assert client.get(FLAGS).status_code == 200
        assert client.get(STATUSES).status_code == 200

    @pytest.mark.parametrize("url", OPEN_BUT_ACCOUNT_LEVEL)
    def test_open_account_level_actions_are_denied(self, kind, url):
        client = _client(_owner(), key=kind, scopes=["identity.user.view"])

        assert client.get(url).status_code == 403, url

    def test_it_cannot_revoke_sessions(self, kind):
        owner = _owner()
        client = _client(owner, key=kind, scopes=["identity.user.view"])

        assert client.post("/api/v1/identity/sessions/revoke-all-other/").status_code == 403

    @pytest.mark.parametrize("url", NO_CODE_VIEWS)
    def test_views_that_check_no_permission_code_refuse_it(self, kind, url):
        client = _client(_owner(), key=kind, scopes=["identity.user.view"])

        response = client.get(url)

        assert response.status_code == 403, url
        assert response.json()["code"] == "credential_scope_not_applicable"

    def test_a_code_outside_the_scopes_is_denied(self, kind):
        client = _client(_owner(), key=kind, scopes=["identity.user.view"])

        assert client.get("/api/v1/projects/").status_code == 403


@pytest.mark.django_db
class TestOtherCredentialsAreUnchanged:
    def test_a_legacy_credential_without_scopes_keeps_the_owners_access(self, kind):
        client = _client(_owner(), key=kind, scopes=[])

        for url in (ME, "/api/v1/identity/profiles/", "/api/v1/roles/", "/api/v1/core/tags/"):
            assert client.get(url).status_code == 200, url

    def test_a_signed_in_session_is_not_a_credential(self):
        owner = _owner()
        client = APIClient()
        client.force_authenticate(user=owner)

        assert client.get("/api/v1/identity/profiles/").status_code == 200
        assert client.get("/api/v1/core/tags/").status_code == 200
