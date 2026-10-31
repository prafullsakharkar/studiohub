"""CR-34: a shot's or asset's assigned artist must be an active member of its project, like a task's assignee."""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import AssetFactory, ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"
KINDS = ("shots", "assets")


@pytest.fixture
def project(staff_user):
    project = ProjectFactory.create(code="CR34")
    ProjectMembership.objects.get_or_create(
        user=staff_user, project=project, defaults={"status": "active", "role": "Lead"}
    )
    return project


@pytest.fixture
def member(project):
    user = UserFactory.create()
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def record(kind, project, **extra):
    return (ShotFactory if kind == "shots" else AssetFactory).create(project=project, **extra)


def url(kind, row):
    return f"{API}/{kind}/{row.pk}/"


@pytest.mark.parametrize("kind", KINDS)
class TestAssigningAnArtist:
    def test_a_project_member_can_be_assigned_and_unassigned(
        self, staff_client, project, member, kind
    ):
        row = record(kind, project)
        assigned = staff_client.patch(
            url(kind, row), {"assigned_artist": str(member.pk)}, format="json"
        )
        assert assigned.status_code == 200, assigned.content
        row.refresh_from_db()
        assert row.assigned_artist_id == member.pk
        cleared = staff_client.patch(url(kind, row), {"assigned_artist": None}, format="json")
        assert cleared.status_code == 200
        row.refresh_from_db()
        assert row.assigned_artist_id is None

    def test_a_user_who_is_not_a_member_is_refused_and_nothing_changes(
        self, staff_client, project, kind
    ):
        row = record(kind, project)
        stranger = UserFactory.create()
        refused = staff_client.patch(
            url(kind, row), {"assigned_artist": str(stranger.pk)}, format="json"
        )
        assert refused.status_code == 400
        assert "assigned_artist" in refused.json()
        row.refresh_from_db()
        assert row.assigned_artist_id is None

    def test_a_member_of_another_project_is_refused(self, staff_client, project, kind):
        elsewhere = ProjectFactory.create(code="CR34-B")
        outsider = UserFactory.create()
        ProjectMembership.objects.create(
            user=outsider, project=elsewhere, status="active", role="Artist"
        )
        row = record(kind, project)
        refused = staff_client.patch(
            url(kind, row), {"assigned_artist": str(outsider.pk)}, format="json"
        )
        assert refused.status_code == 400

    def test_a_member_who_is_no_longer_active_is_refused(self, staff_client, project, member, kind):
        ProjectMembership.objects.filter(user=member, project=project).update(status="inactive")
        row = record(kind, project)
        assert (
            staff_client.patch(
                url(kind, row), {"assigned_artist": str(member.pk)}, format="json"
            ).status_code
            == 400
        )

    def test_creating_with_a_non_member_artist_is_refused_too(self, staff_client, project, kind):
        stranger = UserFactory.create()
        body = {
            "project": str(project.pk),
            "code": "NEW-1",
            "name": "New",
            "assigned_artist": str(stranger.pk),
        }
        if kind == "assets":
            body["category"] = "Prop"
        assert staff_client.post(f"{API}/{kind}/", body, format="json").status_code == 400

    def test_an_artist_who_left_the_project_does_not_block_other_edits(
        self, staff_client, project, member, kind
    ):
        row = record(kind, project, assigned_artist=member)
        ProjectMembership.objects.filter(user=member, project=project).update(status="inactive")
        edited = staff_client.patch(
            url(kind, row), {"description": "Edited after they left"}, format="json"
        )
        assert edited.status_code == 200, edited.content
        same = staff_client.patch(
            url(kind, row), {"assigned_artist": str(member.pk)}, format="json"
        )
        assert same.status_code == 200
        row.refresh_from_db()
        assert row.assigned_artist_id == member.pk


@pytest.mark.parametrize("kind", KINDS)
class TestBulkWrites:
    def _items(self, kind, artist, code):
        data = {"name": "Bulk", "assigned_artist": str(artist.pk)}
        if kind == "assets":
            data["category"] = "Prop"
        return {"code": code, "data": data}

    def test_bulk_create_refuses_a_non_member_artist_and_accepts_a_member(
        self, staff_client, project, member, kind
    ):
        stranger = UserFactory.create()
        response = staff_client.post(
            f"{API}/{kind}/bulk-create/",
            {
                "project_id": str(project.pk),
                "items": [
                    self._items(kind, member, "BULK-OK"),
                    self._items(kind, stranger, "BULK-NO"),
                ],
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        body = response.json()
        assert body["failed"] == 1 and body["successful"] == 1

    def test_bulk_update_refuses_a_non_member_artist(self, staff_client, project, kind):
        stranger = UserFactory.create()
        row = record(kind, project)
        response = staff_client.post(
            f"{API}/{kind}/bulk-update/",
            {"items": [{"id": str(row.pk), "assigned_artist": str(stranger.pk)}]},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.json()["failed"] == 1
        row.refresh_from_db()
        assert row.assigned_artist_id is None
