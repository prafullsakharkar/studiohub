"""
Tests for selective clone-master ({master_ids}) on org-scoped viewsets.

Uses the nested /api/organizations/<org>/roles/clone-master/ route with the
repo's established org-scoping pattern (URL org wins; X-Organization-Id
header passed for parity). Auth setup follows tests/rbac_helpers.py
(grant_org_admin for the admin, plain membership for the non-admin).
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.masterdata.models.platform import PlatformRole
from apps.organization.models import Role
from apps.organization.tests.factories import (
    OrganizationMembershipFactory,
    RoleFactory,
)
from apps.organization.tests.rbac_helpers import grant_org_admin


@pytest.fixture
def org_admin(organization):
    user = UserFactory.create()
    grant_org_admin(user, organization)
    return user


@pytest.fixture
def non_admin_member(organization):
    user = UserFactory.create()
    role = RoleFactory.create(organization=organization)
    OrganizationMembershipFactory.create(
        organization=organization, user=user, role=role, status="active"
    )
    return user


@pytest.mark.django_db
def test_selective_clone_creates_only_selected(api_client, organization, org_admin):
    m1 = PlatformRole.objects.create(name="Animator", code="ANIMATOR")
    PlatformRole.objects.create(name="Compositor", code="COMPOSITOR")
    m3 = PlatformRole.objects.create(name="Lighting", code="LIGHTING")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": [str(m1.id), str(m3.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 200, res.content
    assert res.data["created_count"] == 2
    assert Role.objects.filter(organization=organization, code__in=["animator", "lighting"]).count() == 2
    assert not Role.objects.filter(organization=organization, code="compositor").exists()


@pytest.mark.django_db
def test_reclone_is_idempotent(api_client, organization, org_admin):
    m = PlatformRole.objects.create(name="FX", code="FX")
    api_client.force_authenticate(org_admin)
    url = f"/api/organizations/{organization.id}/roles/clone-master/"
    headers = {"HTTP_X_ORGANIZATION_ID": str(organization.id)}
    first = api_client.post(url, {"master_ids": [str(m.id)]}, format="json", **headers)
    second = api_client.post(url, {"master_ids": [str(m.id)]}, format="json", **headers)
    assert (first.data["created_count"], second.data["created_count"]) == (1, 0)
    assert second.data["existing_count"] == 1


@pytest.mark.django_db
def test_clone_requires_org_admin(api_client, organization, non_admin_member):
    m = PlatformRole.objects.create(name="DMP", code="DMP")
    api_client.force_authenticate(non_admin_member)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": [str(m.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_empty_body_clones_all_legacy(api_client, organization, org_admin):
    PlatformRole.objects.create(name="Animator", code="ANIMATOR")
    PlatformRole.objects.create(name="Compositor", code="COMPOSITOR")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 200, res.content
    assert res.data["created_count"] == 2


@pytest.mark.django_db
def test_empty_master_ids_clones_all(api_client, organization, org_admin):
    PlatformRole.objects.create(name="Animator", code="ANIMATOR")
    PlatformRole.objects.create(name="Compositor", code="COMPOSITOR")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": []},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 200, res.content
    assert res.data["created_count"] == 2


@pytest.mark.django_db
def test_malformed_master_ids_rejected(api_client, organization, org_admin):
    api_client.force_authenticate(org_admin)
    url = f"/api/organizations/{organization.id}/roles/clone-master/"
    headers = {"HTTP_X_ORGANIZATION_ID": str(organization.id)}
    res = api_client.post(url, {"master_ids": "not-a-list"}, format="json", **headers)
    assert res.status_code == 400
    res = api_client.post(url, {"master_ids": ["not-a-uuid"]}, format="json", **headers)
    assert res.status_code == 400


@pytest.mark.django_db
def test_unknown_master_ids_are_noops(api_client, organization, org_admin):
    import uuid

    PlatformRole.objects.create(name="Animator", code="ANIMATOR")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": [str(uuid.uuid4())]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 200, res.content
    assert res.data["created_count"] == 0
    assert res.data["existing_count"] == 0
    assert not Role.objects.filter(organization=organization, code="animator").exists()


@pytest.mark.django_db
def test_clone_is_org_isolated(api_client, organization, org_admin):
    from apps.organization.tests.factories import OrganizationFactory

    other = OrganizationFactory.create()
    m = PlatformRole.objects.create(name="Animator", code="ANIMATOR")
    api_client.force_authenticate(org_admin)
    res = api_client.post(
        f"/api/organizations/{organization.id}/roles/clone-master/",
        {"master_ids": [str(m.id)]},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(organization.id),
    )
    assert res.status_code == 200, res.content
    assert Role.objects.filter(organization=organization, code="animator").exists()
    assert not Role.objects.filter(organization=other).exists()
