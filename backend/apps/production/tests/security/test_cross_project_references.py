"""
Records of another project cannot be referenced (analysis findings F-H2, F-H4,
F-H8, F-M3, WP A3), and the action bodies are validated (WP G2).

A reference to a record of a project the caller cannot use fails with exactly
the same status and message as a reference to a record that does not exist.
"""

from __future__ import annotations

import uuid

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, Task, Timelog, Version
from apps.production.tests.factories import (
    AssetFactory,
    PlaylistFactory,
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db


def _body(resp):
    """Response body without the per-request ``error.request_id`` envelope."""
    return {key: value for key, value in resp.json().items() if key != "error"}


def _member(user, *projects):
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")


def _user(codes, *projects):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    _member(user, *projects)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def project_a():
    return ProjectFactory.create(code="XREFA")


@pytest.fixture
def project_b():
    return ProjectFactory.create(code="XREFB")


VERSION_CODES = (
    "version.view",
    "version.create",
    "version.update",
    "playlist.update",
    "playlist.view",
)


class TestVersionCreate:
    def create(self, user, project, **refs):
        body = {"project_id": str(project.id), "code": f"V{uuid.uuid4().hex[:6]}", **refs}
        return _client(user).post("/api/v1/versions/", body, format="json")

    @pytest.mark.parametrize("field", ["shot", "asset", "task"])
    def test_foreign_record_reads_like_an_unknown_one_for_a_non_member(
        self, project_a, project_b, field
    ):
        factory = {"shot": ShotFactory, "asset": AssetFactory, "task": TaskFactory}[field]
        foreign = factory.create(project=project_b, code="F1")
        user = _user(VERSION_CODES, project_a)

        a = self.create(user, project_a, **{field: str(foreign.id)})
        b = self.create(user, project_a, **{field: str(uuid.uuid4())})

        assert a.status_code == b.status_code == status.HTTP_400_BAD_REQUEST
        assert _body(a) == _body(b)
        assert not Version.objects.filter(project=project_a).exists()

    @pytest.mark.parametrize("field", ["shot", "asset", "task"])
    def test_foreign_record_reads_like_an_unknown_one_for_a_member_of_both(
        self, project_a, project_b, field
    ):
        # A member of both projects still cannot attach B's record to a version of A.
        factory = {"shot": ShotFactory, "asset": AssetFactory, "task": TaskFactory}[field]
        foreign = factory.create(project=project_b, code="F1")
        user = _user(VERSION_CODES, project_a, project_b)

        a = self.create(user, project_a, **{field: str(foreign.id)})
        b = self.create(user, project_a, **{field: str(uuid.uuid4())})

        assert a.status_code == b.status_code == status.HTTP_400_BAD_REQUEST
        assert _body(a) == _body(b)

    def test_records_of_the_versions_own_project_are_accepted(self, project_a):
        shot = ShotFactory.create(project=project_a, code="S1")
        user = _user(VERSION_CODES, project_a)

        resp = self.create(user, project_a, shot=str(shot.id))

        assert resp.status_code == status.HTTP_201_CREATED, resp.json()
        assert Version.objects.get(id=resp.json()["id"]).shot_id == shot.id

    def test_artist_must_be_a_member_of_the_project(self, project_a):
        outsider = UserFactory.create()
        member = _user((), project_a)
        user = _user(VERSION_CODES, project_a)

        assert self.create(user, project_a, artist=str(outsider.id)).status_code == 400
        assert self.create(user, project_a, artist=str(member.id)).status_code == 201


class TestTimelog:
    CODES = ("timelog.view", "timelog.create", "timelog.manage")

    def log(self, user, task, **extra):
        return _client(user).post(
            "/api/v1/timelogs/",
            {"task": str(task.id), "duration_hours": "2.00", "date": "2026-10-26", **extra},
            format="json",
        )

    def test_task_of_a_foreign_project_reads_like_an_unknown_one(self, project_a, project_b):
        foreign = TaskFactory.create(project=project_b, code="T1")
        user = _user(("timelog.view", "timelog.create"), project_a)

        a = self.log(user, foreign)
        b = _client(user).post(
            "/api/v1/timelogs/",
            {"task": str(uuid.uuid4()), "duration_hours": "2.00", "date": "2026-10-26"},
            format="json",
        )

        assert a.status_code == b.status_code == status.HTTP_400_BAD_REQUEST
        assert _body(a) == _body(b)
        assert not Timelog.objects.exists()

    def test_task_code_lookup_does_not_cross_projects(self, project_a, project_b):
        TaskFactory.create(project=project_b, code="SHARED")
        user = _user(("timelog.view", "timelog.create"), project_a)

        resp = _client(user).post(
            "/api/v1/timelogs/",
            {"task_code": "SHARED", "duration_hours": "2.00", "date": "2026-10-26"},
            format="json",
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_time_is_logged_for_the_caller_by_default(self, project_a):
        task = TaskFactory.create(project=project_a, code="T1")
        user = _user(("timelog.view", "timelog.create"), project_a)

        resp = self.log(user, task)

        assert resp.status_code == status.HTTP_201_CREATED, resp.json()
        assert Timelog.objects.get(id=resp.json()["id"]).person_id == user.id

    def test_logging_for_someone_else_needs_the_manage_code(self, project_a):
        task = TaskFactory.create(project=project_a, code="T1")
        colleague = _user((), project_a)
        plain = _user(("timelog.view", "timelog.create"), project_a)

        resp = self.log(plain, task, person=str(colleague.id))

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        assert not Timelog.objects.exists()

    def test_manager_can_log_for_a_member_but_not_for_an_outsider(self, project_a):
        task = TaskFactory.create(project=project_a, code="T1")
        colleague = _user((), project_a)
        outsider = UserFactory.create()
        manager = _user(self.CODES, project_a)

        assert self.log(manager, task, person=str(colleague.id)).status_code == 201
        assert self.log(manager, task, person=str(outsider.id)).status_code == 400


class TestAddToPlaylist:
    def add(self, user, version, **body):
        return _client(user).post(
            f"/api/v1/versions/{version.id}/add-to-playlist/", body, format="json"
        )

    def test_playlist_of_another_project_reads_like_an_unknown_one(self, project_a, project_b):
        version = VersionFactory.create(project=project_a, code="V1")
        foreign = PlaylistFactory.create(project=project_b)
        user = _user(VERSION_CODES, project_a, project_b)

        a = self.add(user, version, playlist_id=str(foreign.id))
        b = self.add(user, version, playlist_id=str(uuid.uuid4()))

        assert a.status_code == b.status_code == status.HTTP_400_BAD_REQUEST
        assert _body(a) == _body(b)
        foreign.refresh_from_db()
        version.refresh_from_db()
        assert foreign.entries == []
        assert version.playlists == []

    def test_playlist_of_a_project_the_caller_is_not_in_is_refused_too(self, project_a, project_b):
        version = VersionFactory.create(project=project_a, code="V1")
        foreign = PlaylistFactory.create(project=project_b)
        user = _user(VERSION_CODES, project_a)

        assert self.add(user, version, playlist_id=str(foreign.id)).status_code == 400
        foreign.refresh_from_db()
        assert foreign.entries == []

    def test_adds_to_a_playlist_of_the_same_project(self, project_a):
        version = VersionFactory.create(project=project_a, code="V1")
        playlist = PlaylistFactory.create(project=project_a)
        user = _user(VERSION_CODES, project_a)

        resp = self.add(user, version, playlist_id=str(playlist.id), playlist_name="Dailies")

        assert resp.status_code == status.HTTP_200_OK, resp.json()
        playlist.refresh_from_db()
        assert [entry["version_id"] for entry in playlist.entries] == [str(version.id)]

    def test_needs_the_playlist_update_code(self, project_a):
        version = VersionFactory.create(project=project_a, code="V1")
        playlist = PlaylistFactory.create(project=project_a)
        user = _user(("version.view", "version.update"), project_a)

        assert self.add(user, version, playlist_id=str(playlist.id)).status_code == 403

    def test_unknown_keys_are_rejected(self, project_a):
        version = VersionFactory.create(project=project_a, code="V1")
        user = _user(VERSION_CODES, project_a)

        resp = self.add(user, version, playlist_id=str(uuid.uuid4()), is_hero=True)

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_hero" in resp.json()


class TestPlaylistEntries:
    CODES = ("playlist.view", "playlist.update")

    def test_entry_version_must_belong_to_the_playlists_project(self, project_a, project_b):
        playlist = PlaylistFactory.create(project=project_a)
        foreign = VersionFactory.create(project=project_b, code="V1")
        user = _user(self.CODES, project_a, project_b)

        resp = _client(user).post(
            f"/api/v1/playlists/{playlist.id}/add-entry/",
            {"version_id": str(foreign.id)},
            format="json",
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        playlist.refresh_from_db()
        assert playlist.entries == []

    def test_server_owns_entry_id_and_order(self, project_a):
        playlist = PlaylistFactory.create(project=project_a)
        version = VersionFactory.create(project=project_a, code="V1")
        user = _user(self.CODES, project_a)

        resp = _client(user).post(
            f"/api/v1/playlists/{playlist.id}/add-entry/",
            {"version_id": str(version.id), "id": "forged", "item_order": 99, "notes_count": 2},
            format="json",
        )

        assert resp.status_code == status.HTTP_200_OK, resp.json()
        playlist.refresh_from_db()
        entry = playlist.entries[0]
        assert entry["id"] != "forged" and entry["item_order"] == 1
        assert entry["notes_count"] == 2

    def test_reorder_cannot_introduce_entries(self, project_a):
        playlist = PlaylistFactory.create(
            project=project_a,
            entries=[{"id": "e1", "item_order": 1}, {"id": "e2", "item_order": 2}],
        )
        user = _user(self.CODES, project_a)
        client = _client(user)
        url = f"/api/v1/playlists/{playlist.id}/reorder/"

        injected = client.post(url, {"entries": [{"id": "e2"}, {"id": "forged"}]}, format="json")
        reordered = client.post(url, {"entries": [{"id": "e2"}, {"id": "e1"}]}, format="json")

        assert injected.status_code == status.HTTP_400_BAD_REQUEST
        assert reordered.status_code == status.HTTP_200_OK
        playlist.refresh_from_db()
        assert [(e["id"], e["item_order"]) for e in playlist.entries] == [("e2", 1), ("e1", 2)]


class TestTaskAssignment:
    CODES = ("task.view", "task.create", "task.update")

    def test_assignee_must_be_a_member_on_create_and_update(self, project_a):
        outsider = UserFactory.create()
        member = _user((), project_a)
        user = _user(self.CODES, project_a)
        client = _client(user)
        body = {"project_id": str(project_a.id), "title": "Comp", "code": "T-NEW"}

        assert (
            client.post(
                "/api/v1/tasks/", {**body, "assignee": str(outsider.id)}, format="json"
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/api/v1/tasks/", {**body, "reviewer": str(outsider.id)}, format="json"
            ).status_code
            == 400
        )
        created = client.post("/api/v1/tasks/", {**body, "assignee": str(member.id)}, format="json")
        assert created.status_code == 201, created.json()

        patched = client.patch(
            f"/api/v1/tasks/{created.json()['id']}/", {"assignee": str(outsider.id)}, format="json"
        )
        assert patched.status_code == 400
        assert Task.objects.get(id=created.json()["id"]).assignee_id == member.id

    def test_bulk_assign_checks_membership_per_task_project(self, project_a, project_b):
        in_a = TaskFactory.create(project=project_a, code="TA")
        in_b = TaskFactory.create(project=project_b, code="TB")
        assignee = _user((), project_a)
        user = _user(self.CODES, project_a, project_b)

        resp = _client(user).post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(in_a.id), str(in_b.id)], "assignee_id": str(assignee.id)},
            format="json",
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        in_a.refresh_from_db()
        in_b.refresh_from_db()
        assert in_a.assignee_id is None and in_b.assignee_id is None

    def test_bulk_assign_within_the_assignees_projects(self, project_a):
        task = TaskFactory.create(project=project_a, code="TA")
        assignee = _user((), project_a)
        user = _user(self.CODES, project_a)

        resp = _client(user).post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "assignee_id": str(assignee.id)},
            format="json",
        )

        assert resp.status_code == status.HTTP_200_OK, resp.json()
        task.refresh_from_db()
        assert task.assignee_id == assignee.id


class TestActionBodies:
    def test_bulk_status_rejects_unknown_keys_and_bad_ids(self, project_a):
        user = _user(("task.view", "task.update"), project_a)
        client = _client(user)

        extra = client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [], "status": "Approved", "x": 1},
            format="json",
        )
        bad_id = client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": ["nope"], "status": "Approved"},
            format="json",
        )
        missing = client.post("/api/v1/tasks/bulk-status/", {"task_ids": []}, format="json")

        assert extra.status_code == bad_id.status_code == missing.status_code == 400
        assert "x" in extra.json() and "task_ids" in bad_id.json() and "status" in missing.json()

    def test_review_actions_reject_unknown_keys(self, project_a):
        review = ReviewFactory.create(project=project_a, status="In Review")
        user = _user(("review.view", "review.update", "review.approve"), project_a)
        client = _client(user)
        base = f"/api/v1/reviews/{review.id}/"

        assert (
            client.post(
                base + "approve/", {"notes": "ok", "status": "Closed"}, format="json"
            ).status_code
            == 400
        )
        assert (
            client.post(
                base + "verdict/", {"verdict": "Approved", "x": 1}, format="json"
            ).status_code
            == 400
        )
        assert (
            client.post(
                base + "comments/", {"text": "hi", "id": "forged"}, format="json"
            ).status_code
            == 400
        )
        assert (
            client.post(
                base + "notes/", {"content": "hi", "is_pinned": "maybe"}, format="json"
            ).status_code
            == 400
        )
        assert client.post(base + "approve/", {"notes": "ok"}, format="json").status_code == 200
        assert client.post(base + "comments/", {"text": "hi"}, format="json").status_code == 201

    def test_publish_accepts_nested_and_flat_info_and_keeps_extra_keys(self, project_a):
        first = VersionFactory.create(project=project_a, code="V1")
        second = VersionFactory.create(project=project_a, code="V2")
        user = _user(("version.view", "version.publish"), project_a)
        client = _client(user)

        nested = client.post(
            f"/api/v1/versions/{first.id}/publish/",
            {"publishing_info": {"dcc_software": "Nuke", "custom": "kept"}},
            format="json",
        )
        flat = client.post(
            f"/api/v1/versions/{second.id}/publish/", {"dcc_software": "Maya"}, format="json"
        )
        typed = client.post(
            f"/api/v1/versions/{second.id}/publish/",
            {"is_hero_promoted": "not-a-bool"},
            format="json",
        )

        assert nested.status_code == flat.status_code == 200
        first.refresh_from_db()
        second.refresh_from_db()
        assert first.publishing_info["custom"] == "kept"
        assert second.publishing_info["dcc_software"] == "Maya"
        assert typed.status_code == status.HTTP_400_BAD_REQUEST

    def test_publish_ignores_a_forged_id_key(self, project_a):
        version = VersionFactory.create(project=project_a, code="V1")
        user = _user(("version.view", "version.publish"), project_a)

        resp = _client(user).post(
            f"/api/v1/versions/{version.id}/publish/", {"id": "forged"}, format="json"
        )

        assert resp.status_code == 200
        version.refresh_from_db()
        assert "id" not in version.publishing_info

    def test_resolve_overbooking_requires_alert_id(self, project_a):
        user = _user((), project_a)

        resp = _client(user).post("/api/v1/scheduling/resolve-overbooking/", {}, format="json")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "alert_id" in resp.json()
