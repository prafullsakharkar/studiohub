"""Server-minted API keys and PATs (no client-fabricated secrets)."""

from __future__ import annotations

import pytest

from apps.identity.api_keys.hashing import APIKeyHasher
from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_api_key_create_mints_server_secret(staff_client, staff_user):
    from apps.organization.models import APIKey

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)

    response = staff_client.post(
        f"/api/organizations/{org.id}/api-keys/",
        {"organization": str(org.id), "name": "CI Key", "scopes": ["read"]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 201, response.content[:500]
    data = response.json()
    plain = data.get("plain_secret")
    assert plain, "create response must reveal the plaintext secret once"
    assert plain.startswith(data["prefix"])
    stored = APIKey.objects.get(pk=data["id"])
    assert stored.hashed_key == APIKeyHasher.hash(plain)
    assert stored.hashed_key != plain


@pytest.mark.django_db
def test_api_key_list_never_exposes_plaintext(staff_client, staff_user):
    from apps.organization.models import APIKey

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    created = staff_client.post(
        f"/api/organizations/{org.id}/api-keys/",
        {"organization": str(org.id), "name": "CI Key"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert created.status_code == 201, created.content[:500]

    listed = staff_client.get(
        f"/api/organizations/{org.id}/api-keys/",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert listed.status_code == 200
    rows = listed.json()["results"] if isinstance(listed.json(), dict) else listed.json()
    assert rows, "expected the created key in the list"
    assert "plain_secret" not in rows[0]
    assert APIKey.objects.filter(pk=created.json()["id"]).exists()


@pytest.mark.django_db
def test_pat_create_mints_server_secret(staff_client, staff_user):
    from apps.organization.models import PersonalAccessToken

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)

    response = staff_client.post(
        f"/api/organizations/{org.id}/pats/",
        {"name": "CI Token", "scopes": ["read"]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 201, response.content[:500]
    data = response.json()
    plain = data.get("plain_secret")
    assert plain, "create response must reveal the plaintext secret once"
    stored = PersonalAccessToken.objects.get(pk=data["id"])
    assert stored.hashed_token == APIKeyHasher.hash(plain)


@pytest.mark.django_db
def test_minted_secrets_authenticate(staff_client, staff_user):
    from apps.organization.services.api_key import APIKeyService

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)

    created = staff_client.post(
        f"/api/organizations/{org.id}/api-keys/",
        {"organization": str(org.id), "name": "Auth Key"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert created.status_code == 201, created.content[:500]
    plain = created.json()["plain_secret"]

    assert APIKeyService.verify(plain) is not None
    assert APIKeyService.verify(plain + "tampered") is None


@pytest.mark.django_db
def test_minted_pat_authenticates_bearer_request(staff_client, staff_user):
    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)

    created = staff_client.post(
        f"/api/organizations/{org.id}/pats/",
        {"name": "Auth Token"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert created.status_code == 201, created.content[:500]
    plain = created.json()["plain_secret"]

    from rest_framework.test import APIClient

    probe = APIClient()
    response = probe.get(
        "/api/v1/organizations/",
        HTTP_AUTHORIZATION=f"Token {plain}",
    )
    assert response.status_code != 401, response.content[:300]
