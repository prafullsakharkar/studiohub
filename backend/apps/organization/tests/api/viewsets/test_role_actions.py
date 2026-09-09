"""
Tests for RoleViewSet clone and permission add/remove actions.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import RolePermissions
from apps.organization.models import RolePermission
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)

ROLE_PERMISSION_CODES = (
    RolePermissions.VIEW,
    RolePermissions.CREATE,
    RolePermissions.UPDATE,
    RolePermissions.GRANT_PERMISSION,
    RolePermissions.REVOKE_PERMISSION,
)


def _role_permission(code):
    module, action = code.split(".", 1)
    return PermissionFactory.create(code=code, module=module, action=action)


def _grant_role_permissions(user, organization):
    role = RoleFactory.create(organization=organization)
    for code in ROLE_PERMISSION_CODES:
        RolePermissionFactory.create(role=role, permission=_role_permission(code))
    UserRoleFactory.create(user=user, role=role)
    return role


def _detail_url(role):
    return reverse("api:v1:organization:role-detail", kwargs={"uuid": str(role.id)})


def _clone_url(role):
    return reverse("api:v1:organization:role-clone", kwargs={"uuid": str(role.id)})


def _add_url(role):
    return reverse("api:v1:organization:role-add-permissions", kwargs={"uuid": str(role.id)})


def _remove_url(role):
    return reverse(
        "api:v1:organization:role-remove-permissions", kwargs={"uuid": str(role.id)}
    )


class TestRoleClone:
    @pytest.mark.django_db
    def test_clone_unauthenticated_401(self, api_client):
        role = RoleFactory.create()

        response = api_client.post(_clone_url(role), {"name": "X", "code": "x"})

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_clone_copies_role_and_permissions(self, staff_client):
        role = RoleFactory.create(name="Producer", code="PRODUCER")
        perm = _role_permission("organization.view")
        RolePermissionFactory.create(role=role, permission=perm)

        response = staff_client.post(
            _clone_url(role),
            {"name": "Senior Producer", "code": "SENIOR-PRODUCER"},
            format="json",
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Senior Producer"
        assert data["code"] == "SENIOR-PRODUCER"
        assert RolePermission.objects.filter(
            role_id=data["id"], permission=perm
        ).exists()

    @pytest.mark.django_db
    def test_clone_requires_name_and_code(self, staff_client):
        role = RoleFactory.create()

        response = staff_client.post(_clone_url(role), {"name": "No Code"}, format="json")

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_clone_duplicate_code_409(self, staff_client):
        role = RoleFactory.create()
        RoleFactory.create(code="TAKEN-CODE")

        response = staff_client.post(
            _clone_url(role),
            {"name": "Copy", "code": "TAKEN-CODE"},
            format="json",
        )

        assert response.status_code == 409


class TestRolePermissionActions:
    @pytest.mark.django_db
    def test_add_and_remove_permissions(self, staff_client):
        role = RoleFactory.create()
        perm = _role_permission("organization.view")

        response = staff_client.post(_add_url(role), {"codes": [perm.code]}, format="json")

        assert response.status_code == 200
        assert response.json()["added"] == [perm.code]
        assert RolePermission.objects.filter(role=role, permission=perm).exists()

        # Idempotent re-add.
        response = staff_client.post(_add_url(role), {"codes": [perm.code]}, format="json")
        assert response.status_code == 200

        response = staff_client.post(
            _remove_url(role), {"codes": [perm.code]}, format="json"
        )

        assert response.status_code == 200
        assert response.json()["removed"] == [perm.code]
        assert not RolePermission.objects.filter(role=role, permission=perm).exists()

    @pytest.mark.django_db
    def test_unknown_codes_reported(self, staff_client):
        role = RoleFactory.create()

        response = staff_client.post(
            _add_url(role), {"codes": ["nope.missing"]}, format="json"
        )

        assert response.status_code == 200
        assert response.json()["unknown"] == ["nope.missing"]

    @pytest.mark.django_db
    def test_codes_must_be_list(self, staff_client):
        role = RoleFactory.create()

        response = staff_client.post(_add_url(role), {"codes": "organization.view"})

        assert response.status_code == 400

    @pytest.mark.django_db
    def test_scoped_user_with_grants_can_clone(self, db):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(organization=org, user=user)
        _grant_role_permissions(user, org)
        api = APIClient()
        api.force_authenticate(user=user)
        api.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))
        role = RoleFactory.create(organization=org)

        response = api.post(
            _clone_url(role), {"name": "Clone", "code": "CLONE-ROLE"}, format="json"
        )

        assert response.status_code == 201

    @pytest.mark.django_db
    def test_user_without_grants_gets_403(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        role = RoleFactory.create()

        response = api.post(_clone_url(role), {"name": "X", "code": "X-CODE"})

        assert response.status_code == 403
