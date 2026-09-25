"""
Person organization-isolation tests (Phase 3 gap P0-2).

People are organization-scoped: scoped reads only return rows belonging to the
request organization (fail closed), superusers stay unscoped (ADR-0033 D4),
and creates default to the request organization when the payload names none.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import PersonPermissions
from apps.organization.models import Person
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
)


def _permission(code):
    module, action = code.split(".", 1)
    return PermissionFactory.create(code=code, module=module, action=action)


def _grant_person_permissions(user, organization):
    role = RoleFactory.create(organization=organization)
    for code in PERSON_CODES:
        RolePermissionFactory.create(role=role, permission=_permission(code))
    UserRoleFactory.create(user=user, role=role)
    return role


def _member_client(user, organization):
    OrganizationMembershipFactory.create(user=user, organization=organization)
    _grant_person_permissions(user, organization)
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_ORGANIZATION_ID=str(organization.id))
    return client


def _list_url():
    return reverse("api:v1:organization-legacy:legacy-person-list")


@pytest.mark.django_db
class TestPersonIsolation:
    def test_scoped_user_sees_only_own_org(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        PersonFactory.create(organization=org_a, name="A One")
        PersonFactory.create(organization=org_b, name="B One")
        user = UserFactory.create()
        client = _member_client(user, org_a)

        response = client.get(_list_url())

        assert response.status_code == 200, response.data
        names = [row["name"] for row in response.data["results"]]
        assert names == ["A One"]

    def test_legacy_null_org_rows_hidden_from_scoped_reads(self):
        org = OrganizationFactory.create()
        PersonFactory.create(organization=None, name="Legacy")
        user = UserFactory.create()
        client = _member_client(user, org)

        response = client.get(_list_url())

        assert response.status_code == 200, response.data
        assert response.data["count"] == 0

    def test_staff_sees_all_orgs(self, admin_client):
        """Superuser break-glass stays unscoped; plain staff does not (D4)."""
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        PersonFactory.create(organization=org_a)
        PersonFactory.create(organization=org_b)
        PersonFactory.create(organization=None)

        response = admin_client.get(_list_url())

        assert response.status_code == 200, response.data
        assert response.data["count"] == 3

    def test_create_defaults_to_request_org(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        client = _member_client(user, org)

        response = client.post(_list_url(), {"name": "New Hire"}, format="json")

        assert response.status_code == 201, response.data
        person = Person.objects.get(name="New Hire", organization=org)
        assert person.organization_id == org.id

    def test_detail_of_other_org_returns_404(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        other = PersonFactory.create(organization=org_b)
        user = UserFactory.create()
        client = _member_client(user, org_a)

        url = reverse(
            "api:v1:organization-legacy:legacy-person-detail",
            kwargs={"uuid": str(other.id)},
        )
        response = client.get(url)

        assert response.status_code == 404
