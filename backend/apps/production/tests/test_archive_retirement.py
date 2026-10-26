"""
Archived means soft-deleted; ``is_archived`` is derived from that (DECISIONS D-25).

Task, Asset, Version, Playlist and Workflow used to carry a separate flag that some archived
by itself. Now one marker rules: archiving soft-deletes, the flag in responses is read from it,
sending it is a 400 unless unchanged, ``?is_archived=`` selects by it, and the old column is
neither read nor written.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Asset, Playlist, ProjectMembership, Task, Version, Workflow
from apps.production.tests.factories import (
    AssetFactory,
    PlaylistFactory,
    ProjectFactory,
    TaskFactory,
    VersionFactory,
    WorkflowFactory,
)

pytestmark = pytest.mark.django_db

CASES = [
    pytest.param("tasks", Task, lambda p, n: TaskFactory.create(project=p, code=n), "task", id="task"),
    pytest.param("assets", Asset, lambda p, n: AssetFactory.create(project=p, code=n), "asset", id="asset"),
    pytest.param("versions", Version, lambda p, n: VersionFactory.create(project=p, code=n), "version", id="version"),
    pytest.param("playlists", Playlist, lambda p, n: PlaylistFactory.create(project=p, code=n), "playlist", id="playlist"),
    pytest.param("workflows", Workflow, lambda p, n: WorkflowFactory.create(project=p, code=n), "workflow", id="workflow"),
]  # fmt: skip


@pytest.fixture
def project():
    return ProjectFactory.create(code="ARC1")


def _client(project, resource):
    user = UserFactory.create()
    grant_permissions(
        user, *(f"{resource}.{action}" for action in ("view", "create", "update", "delete"))
    )
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _listed(api, path, query=""):
    body = api.get(f"/api/v1/{path}/{query}").json()
    rows = body["results"] if isinstance(body, dict) and "results" in body else body
    return {row["code"] for row in rows}


@pytest.mark.parametrize(("path", "model", "make", "resource"), CASES)
class TestArchiveIsTheSoftDelete:
    def test_archiving_soft_deletes_and_the_flag_follows(
        self, project, path, model, make, resource
    ):
        row = make(project, "ARC-A")
        api = _client(project, resource)

        resp = api.post(f"/api/v1/{path}/{row.id}/archive/")

        assert resp.status_code == 200, resp.json()
        assert resp.json()["is_archived"] is True
        assert model.all_objects.get(pk=row.pk).is_deleted is True
        assert "ARC-A" not in _listed(api, path)

    def test_archived_rows_are_listed_by_asking_for_them(
        self, project, path, model, make, resource
    ):
        live, gone = make(project, "ARC-LIVE"), make(project, "ARC-GONE")
        api = _client(project, resource)
        assert api.post(f"/api/v1/{path}/{gone.id}/archive/").status_code == 200

        assert _listed(api, path, "?is_archived=true") == {"ARC-GONE"}
        assert _listed(api, path, "?is_archived=false") == {"ARC-LIVE"} or _listed(api, path) == {
            "ARC-LIVE"
        }
        assert live.pk

    def test_restoring_brings_it_back_not_archived(self, project, path, model, make, resource):
        row = make(project, "ARC-R")
        api = _client(project, resource)
        api.post(f"/api/v1/{path}/{row.id}/archive/")

        resp = api.post(f"/api/v1/{path}/{row.id}/restore/")

        assert resp.status_code == 200, resp.json()
        assert resp.json()["is_archived"] is False
        assert "ARC-R" in _listed(api, path)

    def test_the_flag_cannot_be_written_but_may_be_echoed(
        self, project, path, model, make, resource
    ):
        row = make(project, "ARC-W")
        api = _client(project, resource)

        changed = api.patch(f"/api/v1/{path}/{row.id}/", {"is_archived": True}, format="json")
        echoed = api.patch(
            f"/api/v1/{path}/{row.id}/",
            {"is_archived": False, "description": "kept"},
            format="json",
        )

        if resource == "workflow":  # its update form never took the flag: ignored, not refused
            assert changed.status_code == 200
        else:
            assert changed.status_code == 400 and "is_archived" in changed.json(), changed.json()
        assert echoed.status_code == 200, echoed.json()
        assert model.all_objects.get(pk=row.pk).is_deleted is False


def test_an_archived_playlist_is_labelled_and_a_restored_one_is_active_again(project):
    row = PlaylistFactory.create(project=project, code="ARC-P")
    api = _client(project, "playlist")

    api.post(f"/api/v1/playlists/{row.id}/archive/")
    assert Playlist.all_objects.get(pk=row.pk).status == "Archived"
    api.post(f"/api/v1/playlists/{row.id}/restore/")

    assert Playlist.all_objects.get(pk=row.pk).status == "Active"


def test_an_archived_workflow_stops_running_and_stays_off_when_restored(project):
    row = WorkflowFactory.create(project=project, code="ARC-F", is_active=True)
    api = _client(project, "workflow")

    api.post(f"/api/v1/workflows/{row.id}/archive/")
    assert Workflow.all_objects.get(pk=row.pk).is_active is False
    api.post(f"/api/v1/workflows/{row.id}/restore/")

    restored = Workflow.all_objects.get(pk=row.pk)
    assert (restored.is_deleted, restored.is_active) == (False, False)


def test_an_archived_version_leaves_the_shots_current_version(project):
    from apps.production.selectors.rollups import ShotCurrentVersionSelector
    from apps.production.tests.factories import ShotFactory

    shot = ShotFactory.create(project=project, code="S1")
    older = VersionFactory.create(
        project=project, shot=shot, code="V1", version_number="v001", version_index=1
    )
    newer = VersionFactory.create(
        project=project, shot=shot, code="V2", version_number="v002", version_index=2
    )
    api = _client(project, "version")
    assert ShotCurrentVersionSelector.of(shot)[1] == newer.id

    assert api.post(f"/api/v1/versions/{newer.id}/archive/").status_code == 200

    assert ShotCurrentVersionSelector.of(shot) == ("v001", older.id)


def test_without_the_delete_grant_archived_rows_stay_out_of_reach(project):
    row = TaskFactory.create(project=project, code="ARC-X")
    owner = _client(project, "task")
    owner.post(f"/api/v1/tasks/{row.id}/archive/")
    reader = UserFactory.create()
    grant_permissions(reader, "task.view")
    ProjectMembership.objects.create(user=reader, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=reader)

    assert _listed(api, "tasks", "?is_archived=true") == set()
