"""
ProjectMembership canonical status + role link (N2/N7 consolidation).

Memberships are project-scoped only: no organization FK. ``role_ref``
points at the global identity ``Role``; the ``role`` Char snapshot is
preserved verbatim.
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.identity.models import Role
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

User = get_user_model()


def make_membership(status="Active", role="Artist"):
    import uuid as _uuid

    user = User.objects.create_user(
        email=f"m-{_uuid.uuid4().hex[:8]}@pmx.io", password="x"
    )
    project = ProjectFactory.create()
    return ProjectMembership.objects.create(
        project=project, user=user, status=status, role=role
    )


@pytest.mark.django_db
def test_save_normalizes_known_status_case():
    m = make_membership("Active")
    m.refresh_from_db()
    assert m.status == "active"


@pytest.mark.django_db
def test_status_choices_reject_garbage_on_save():
    m = make_membership("active")
    m.status = "bogus"
    with pytest.raises(ValidationError):
        m.full_clean()


@pytest.mark.django_db
def test_role_ref_links_identity_role():
    role = Role.objects.create(code="pmx-artist", name="PMX Artist")
    user = User.objects.create_user(email="rr@pmx.io", password="x")
    project = ProjectFactory.create()
    membership = ProjectMembership.objects.create(
        project=project, user=user, role="Artist", role_ref=role
    )
    membership.refresh_from_db()
    assert membership.role_ref is not None
    assert membership.role_ref.code == "pmx-artist"
    assert membership.role == "Artist"


@pytest.mark.django_db
def test_role_char_without_ref_leaves_null():
    user = User.objects.create_user(email="rr2@pmx.io", password="x")
    project = ProjectFactory.create()
    membership = ProjectMembership.objects.create(
        project=project, user=user, role="Space Captain"
    )
    membership.refresh_from_db()
    assert membership.role_ref_id is None
    assert membership.role == "Space Captain"


def _members_url(project):
    return f"/api/organizations/projects/{project.id}/members/"


@pytest.mark.django_db
def test_add_member_rejects_unknown_role_id(admin_client):
    import uuid

    project = ProjectFactory.create()
    target = User.objects.create_user(email="target@pmr3.io", password="x")
    url = _members_url(project)

    response = admin_client.post(
        url,
        {"user_id": str(target.id), "role": "Artist", "role_id": str(uuid.uuid4())},
        format="json",
    )

    assert response.status_code == 400
    assert "role_id" in response.data


@pytest.mark.django_db
def test_add_member_links_valid_role_id(admin_client):
    role = Role.objects.create(code="pmr5-artist", name="PMR5 Artist")
    project = ProjectFactory.create()
    target = User.objects.create_user(email="target@pmr5.io", password="x")
    url = _members_url(project)

    response = admin_client.post(
        url,
        {"user_id": str(target.id), "role": "Artist", "role_id": str(role.id)},
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["role_id"] == str(role.id)


@pytest.mark.django_db
def test_add_member_honors_requested_status(admin_client):
    project = ProjectFactory.create()
    target = User.objects.create_user(email="target@pmr6.io", password="x")
    url = _members_url(project)

    response = admin_client.post(
        url,
        {"user_id": str(target.id), "role": "Artist", "status": "Suspended"},
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["status"] == "suspended"
