"""
ProjectMembership canonical status + role link (N2/N7 consolidation).
"""

from __future__ import annotations

import importlib

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.organization.models import Organization
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

User = get_user_model()

STATUS_MIGRATION_MODULE = "apps.production.migrations.0018_map_project_membership_status"


def make_membership(status="Active", role="Artist"):
    org = Organization.objects.create(code="PMX", name="PMX", slug="pmx")
    user = User.objects.create_user(email="m@pmx.io", password="x")
    project = ProjectFactory.create(organization=org)
    return ProjectMembership.objects.create(
        organization=org, project=project, user=user, status=status, role=role
    )


@pytest.mark.django_db
def test_save_normalizes_known_status_case():
    m = make_membership("Active")
    m.refresh_from_db()
    assert m.status == "active"


@pytest.mark.django_db
def test_backfill_maps_unknown_status_to_active():
    backfill = importlib.import_module(
        STATUS_MIGRATION_MODULE
    ).backfill_project_membership_statuses
    # Bypass save() normalization to plant a genuinely unknown value.
    m = make_membership("active")
    ProjectMembership.objects.filter(id=m.id).update(status="Pending")

    backfill(apps, None)
    m.refresh_from_db()

    assert m.status == "active"


@pytest.mark.django_db
def test_status_choices_reject_garbage_on_save():
    m = make_membership("active")
    m.status = "bogus"
    with pytest.raises(ValidationError):
        m.full_clean()


ROLE_BACKFILL_MODULE = "apps.production.migrations.0020_backfill_project_membership_role_ref"


def _org_with_user(code):
    org = Organization.objects.create(code=code, name=code, slug=code.lower())
    user = User.objects.create_user(email=f"{code.lower()}@pmx.io", password="x")
    return org, user


@pytest.mark.django_db
def test_role_ref_backfills_on_matching_code():
    from apps.organization.tests.factories import RoleFactory

    backfill = importlib.import_module(ROLE_BACKFILL_MODULE).backfill_project_membership_roles
    org, user = _org_with_user("PMR1")
    RoleFactory.create(code="artist", name="Artist", organization=org)
    project = ProjectFactory.create(organization=org)
    membership = ProjectMembership.objects.create(
        organization=org, project=project, user=user, role="artist"
    )
    assert membership.role_ref_id is None

    backfill(apps, None)
    membership.refresh_from_db()

    assert membership.role_ref is not None
    assert membership.role_ref.code == "artist"
    assert membership.role == "artist"


@pytest.mark.django_db
def test_role_ref_mismatch_leaves_null_with_char_intact():
    backfill = importlib.import_module(ROLE_BACKFILL_MODULE).backfill_project_membership_roles
    org, user = _org_with_user("PMR2")
    project = ProjectFactory.create(organization=org)
    membership = ProjectMembership.objects.create(
        organization=org, project=project, user=user, role="Space Captain"
    )

    backfill(apps, None)
    membership.refresh_from_db()

    assert membership.role_ref_id is None
    assert membership.role == "Space Captain"


@pytest.mark.django_db
def test_add_member_rejects_unknown_role_id(admin_client):
    from apps.organization.tests.factories import RoleFactory as _RF  # noqa: F401

    org, _ = _org_with_user("PMR3")
    project = ProjectFactory.create(organization=org)
    target = User.objects.create_user(email="target@pmr3.io", password="x")
    url = f"/api/organizations/{org.id}/projects/{project.id}/members/"

    import uuid

    response = admin_client.post(
        url,
        {"user_id": str(target.id), "role": "Artist", "role_id": str(uuid.uuid4())},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 400
    assert "role_id" in response.data


@pytest.mark.django_db
def test_add_member_rejects_sibling_org_role_id(admin_client):
    from apps.organization.tests.factories import RoleFactory

    org, _ = _org_with_user("PMR4")
    sibling = Organization.objects.create(code="SIB4", name="SIB4", slug="sib4")
    foreign = RoleFactory.create(code="sib-only", name="Sibling Only", organization=sibling)
    project = ProjectFactory.create(organization=org)
    target = User.objects.create_user(email="target@pmr4.io", password="x")
    url = f"/api/organizations/{org.id}/projects/{project.id}/members/"

    response = admin_client.post(
        url,
        {"user_id": str(target.id), "role": "Artist", "role_id": str(foreign.id)},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 400
    assert "role_id" in response.data


@pytest.mark.django_db
def test_add_member_links_valid_role_id(admin_client):
    from apps.organization.tests.factories import RoleFactory

    org, _ = _org_with_user("PMR5")
    role = RoleFactory.create(code="pmr5-artist", name="PMR5 Artist", organization=org)
    project = ProjectFactory.create(organization=org)
    target = User.objects.create_user(email="target@pmr5.io", password="x")
    url = f"/api/organizations/{org.id}/projects/{project.id}/members/"

    response = admin_client.post(
        url,
        {"user_id": str(target.id), "role": "Artist", "role_id": str(role.id)},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 201, response.data
    assert response.data["role_id"] == str(role.id)
