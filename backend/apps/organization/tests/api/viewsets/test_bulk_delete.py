"""Bulk delete on nested org entity routes (departments as representative)."""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.organization.models import Department, OrganizationMembership
from apps.organization.tests.factories import (
    DepartmentFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_bulk_delete_departments(staff_client, staff_user):
    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    keep = DepartmentFactory.create(organization=org, name="Keep Dept")
    gone1 = DepartmentFactory.create(organization=org, name="Gone One")
    gone2 = DepartmentFactory.create(organization=org, name="Gone Two")

    response = staff_client.post(
        f"/api/organizations/{org.id}/departments/bulk-delete/",
        {"ids": [str(gone1.id), str(gone2.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 200, response.content[:500]
    data = response.json()
    assert data["successful"] == 2
    assert data["failed"] == 0
    assert Department.objects.filter(pk=keep.pk).exists()
    assert not Department.objects.active().filter(pk__in=[gone1.pk, gone2.pk]).exists()


@pytest.mark.django_db
def test_bulk_delete_partial_unknown_ids(staff_client, staff_user):
    import uuid

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    gone = DepartmentFactory.create(organization=org, name="Gone")

    response = staff_client.post(
        f"/api/organizations/{org.id}/departments/bulk-delete/",
        {"ids": [str(gone.id), str(uuid.uuid4())]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 200, response.content[:500]
    data = response.json()
    assert data["successful"] == 1
    assert data["failed"] == 1
    assert data["results"][1]["status"] == "not_found"
    assert not Department.objects.active().filter(pk=gone.pk).exists()


@pytest.mark.django_db
def test_bulk_delete_never_touches_other_org(staff_client, staff_user):
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org_a)
    grant_all_known_codes(staff_user, org_b)
    foreign = DepartmentFactory.create(organization=org_b, name="Foreign")

    response = staff_client.post(
        f"/api/organizations/{org_a.id}/departments/bulk-delete/",
        {"ids": [str(foreign.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org_a.id),
    )

    assert response.status_code == 200, response.content[:500]
    assert response.json()["failed"] == 1
    assert Department.objects.filter(pk=foreign.pk).exists()


@pytest.mark.django_db
def test_bulk_delete_requires_delete_permission(staff_client, staff_user):
    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    # Downgrade: membership role with view-only grants is covered by the
    # fail-closed permission map (bulk_delete absent without DELETE).
    target = DepartmentFactory.create(organization=org, name="Keep")

    from rest_framework.test import APIClient

    limited = UserFactory.create()
    role = RoleFactory.create(organization=org)

    perm = PermissionFactory.create(code="department.view", module="department", action="view")

    RolePermissionFactory.create(role=role, permission=perm)
    OrganizationMembershipFactory.create(user=limited, organization=org, role=role)
    UserRoleFactory.create(user=limited, role=role)

    probe = APIClient()
    probe.force_authenticate(user=limited)
    response = probe.post(
        f"/api/organizations/{org.id}/departments/bulk-delete/",
        {"ids": [str(target.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 403, response.content[:300]
    assert Department.objects.filter(pk=target.pk).exists()
