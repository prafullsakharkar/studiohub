"""
C1 — credential authenticators must honor the principal's account state.

A PAT or API key belongs to a specific user; that user's ``is_active``
flag is the kill switch the JWT path already honors. Deactivated users
must not retain API access through static credentials.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.api_keys.hashing import APIKeyHasher
from apps.identity.models import ApiKey, PersonalAccessToken
from apps.identity.tests.factories import UserFactory

USERS_ME_URL = "/api/v1/identity/users/me/"


def _make_token_soup(user, *, key: bool = False):
    """Create a PersonalAccessToken or ApiKey for ``user``; return the plain secret + header."""
    plain = f"probe{'k' if key else 't'}.secr1234567890abcdef"

    if key:
        ApiKey.objects.create(
            name="probe key",
            prefix=plain.split(".", 1)[0],
            hashed_key=APIKeyHasher.hash(plain),
            created_by=user,
            scopes=[],
            is_active=True,
        )
        header = f"Api-Key {plain}"
    else:
        PersonalAccessToken.objects.create(
            user=user,
            name="probe token",
            prefix=plain.split(".", 1)[0],
            hashed_token=APIKeyHasher.hash(plain),
            scopes=[],
            is_active=True,
        )
        header = f"Token {plain}"

    return header


@pytest.mark.django_db
class TestCredentialAuthHonorsAccountState:
    def test_pat_authenticates_active_user(self, api_client: APIClient):
        user = UserFactory.create(is_active=True)
        header = _make_token_soup(user)

        response = api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header)

        assert response.status_code == 200

    def test_pat_denied_after_owner_deactivated(self, api_client: APIClient):
        user = UserFactory.create(is_active=True)
        header = _make_token_soup(user)
        assert api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header).status_code == 200
        pat = PersonalAccessToken.objects.get(user=user)
        baseline = pat.last_used_at
        assert baseline is not None  # baseline request touched last-used

        user.is_active = False
        user.save(update_fields=["is_active"])

        response = api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header)

        assert response.status_code == 401
        # A rejected credential must not refresh last-used telemetry.
        pat.refresh_from_db()
        assert pat.last_used_at == baseline

    def test_pat_restored_after_reactivation(self, api_client: APIClient):
        user = UserFactory.create(is_active=False)
        header = _make_token_soup(user)
        assert api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header).status_code == 401

        user.is_active = True
        user.save(update_fields=["is_active"])

        assert api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header).status_code == 200

    def test_api_key_authenticates_active_owner(self, api_client: APIClient):
        user = UserFactory.create(is_active=True)
        header = _make_token_soup(user, key=True)

        response = api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header)

        assert response.status_code == 200

    def test_api_key_denied_after_owner_deactivated(self, api_client: APIClient):
        user = UserFactory.create(is_active=True)
        header = _make_token_soup(user, key=True)

        user.is_active = False
        user.save(update_fields=["is_active"])

        response = api_client.get(USERS_ME_URL, HTTP_AUTHORIZATION=header)

        assert response.status_code == 401
