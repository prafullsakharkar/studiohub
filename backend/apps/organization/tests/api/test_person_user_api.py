"""
Person.user_id API exposure (N1 consolidation).

Read shape gains ``user_id``; writes accept ``user_id`` resolved fail-closed
(unknown id -> 400). Mirrors the isolation suite's auth/URL patterns.
"""

from __future__ import annotations

import uuid

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import PersonPermissions
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    PersonFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)

PERSON_CODES = (
    PersonPermissions.VIEW,
    PersonPermissions.CREATE,
    PersonPermissions.UPDATE,
)


def _permission(code):
    module, action = code.split(".", 1)
    return PermissionFactory.create(code=code, module=module, action=action)


def _member_client(user, organization):
    OrganizationMembershipFactory.create(user=user, organization=organization)
    role = RoleFactory.create(organization=organization)
    for code in PERSON_CODES:
        RolePermissionFactory.create(role=role, permission=_permission(code))
    UserRoleFactory.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_ORGANIZATION_ID=str(organization.id))
    return client


def _detail_url(person):
    return reverse(
        "api:v1:organization-legacy:legacy-person-detail",
        kwargs={"uuid": str(person.id)},
    )


def _list_url():
    return reverse("api:v1:organization-legacy:legacy-person-list")


@pytest.mark.django_db
def test_person_detail_exposes_user_id():
    org = OrganizationFactory.create()
    user = UserFactory.create()
    linked = UserFactory.create()
    person = PersonFactory.create(organization=org, name="Linked", user=linked)
    client = _member_client(user, org)

    response = client.get(_detail_url(person))

    assert response.status_code == 200
    assert response.data["user_id"] == str(linked.id)


@pytest.mark.django_db
def test_person_detail_user_id_null_when_unlinked():
    org = OrganizationFactory.create()
    user = UserFactory.create()
    person = PersonFactory.create(organization=org, name="Solo")
    client = _member_client(user, org)

    response = client.get(_detail_url(person))

    assert response.status_code == 200
    assert response.data["user_id"] is None


@pytest.mark.django_db
def test_person_create_links_user_id():
    org = OrganizationFactory.create()
    user = UserFactory.create()
    linked = UserFactory.create()
    client = _member_client(user, org)

    response = client.post(
        _list_url(),
        {"name": "New Hire", "email": "hire@example.com", "user_id": str(linked.id)},
        format="json",
    )

    assert response.status_code == 201, response.data
    created_id = response.data["id"]
    detail = client.get(
        reverse(
            "api:v1:organization-legacy:legacy-person-detail",
            kwargs={"uuid": created_id},
        )
    )
    assert detail.status_code == 200
    assert detail.data["user_id"] == str(linked.id)


@pytest.mark.django_db
def test_person_create_rejects_unknown_user_id():
    org = OrganizationFactory.create()
    user = UserFactory.create()
    client = _member_client(user, org)

    response = client.post(
        _list_url(),
        {"name": "Ghost", "email": "ghost@example.com", "user_id": str(uuid.uuid4())},
        format="json",
    )

    assert response.status_code == 400
    assert "user_id" in response.data


@pytest.mark.django_db
def test_person_update_links_and_clears_user_id():
    org = OrganizationFactory.create()
    user = UserFactory.create()
    first = UserFactory.create()
    second = UserFactory.create()
    person = PersonFactory.create(organization=org, name="Mover", user=first)
    client = _member_client(user, org)

    response = client.patch(
        _detail_url(person), {"user_id": str(second.id)}, format="json"
    )
    assert response.status_code == 200, response.data
    person.refresh_from_db()
    assert person.user_id == second.id

    response = client.patch(_detail_url(person), {"user_id": None}, format="json")
    assert response.status_code == 200, response.data
    person.refresh_from_db()
    assert person.user_id is None
