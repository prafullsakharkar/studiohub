"""
Code rules (WP B3, B4; DECISIONS D-10).

Codes are stored upper case, unique per project whatever the case (also against
soft-deleted rows), free of spaces and slashes, and a shot's or asset's code is frozen
once a version exists; the deliberate rename is ``rename-code``.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from apps.audit.models import ChangeLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import (
    Asset,
    Episode,
    ProjectMembership,
    Sequence,
    Shot,
    Task,
    Version,
)
from apps.production.tests.factories import (
    AssetFactory,
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

FACTORIES = {
    "shot": (Shot, ShotFactory),
    "sequence": (Sequence, SequenceFactory),
    "asset": (Asset, AssetFactory),
    "task": (Task, TaskFactory),
    "version": (Version, VersionFactory),
    "episode": (Episode, EpisodeFactory),
}


@pytest.fixture
def project():
    return ProjectFactory.create(code="CODE1", workflow_type="standard")


def _user(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _crud(name):
    return [f"{name}.view", f"{name}.create", f"{name}.update"]


class TestUniqueWhateverTheCase:
    @pytest.mark.parametrize("name", sorted(FACTORIES))
    def test_the_database_refuses_a_code_that_differs_only_by_case(self, project, name):
        model, factory = FACTORIES[name]
        factory.create(project=project, code="AB010")

        with pytest.raises(IntegrityError, match="ucode_uniq"), transaction.atomic():
            model.objects.create(**{**_minimal(name, project), "code": "ab010"})

    @pytest.mark.parametrize("name", ["shot", "sequence", "asset"])
    def test_the_api_stores_upper_case_and_refuses_a_case_variant(self, project, name):
        user = _user(project, *_crud(name))
        client = _client(user)
        url = f"/api/v1/{name}s/"
        body = {"project_id": str(project.id), "name": "n"}

        first = client.post(url, {**body, "code": "ab010"}, format="json")
        second = client.post(url, {**body, "code": "Ab010"}, format="json")

        assert first.status_code == 201, first.json()
        assert FACTORIES[name][0].objects.get(id=first.json()["id"]).code == "AB010"
        assert second.status_code == 400
        assert FACTORIES[name][0].objects.filter(project=project, code__iexact="ab010").count() == 1

    def test_a_soft_deleted_row_still_owns_its_code(self, project):
        shot = ShotFactory.create(project=project, code="GONE1")
        shot.delete()
        user = _user(project, *_crud("shot"))

        resp = _client(user).post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "gone1", "name": "n"},
            format="json",
        )

        assert resp.status_code == 400

    def test_bulk_create_sees_a_case_variant_as_existing(self, project):
        ShotFactory.create(project=project, code="BULK1")
        user = _user(project, *_crud("shot"))

        resp = _client(user).post(
            "/api/v1/shots/bulk-create/",
            {"items": [{"project_id": str(project.id), "code": "bulk1"}]},
            format="json",
        )

        assert resp.json()["results"][0]["status"] == "exists"

    def test_other_projects_may_reuse_a_code(self, project):
        other = ProjectFactory.create(code="CODE2")
        ShotFactory.create(project=other, code="SH010")
        user = _user(project, *_crud("shot"))

        resp = _client(user).post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "sh010", "name": "n"},
            format="json",
        )

        assert resp.status_code == 201, resp.json()


class TestFormat:
    @pytest.mark.parametrize("bad", ["SH 010", "SH/010", "SH\\010", "SH\t1"])
    def test_spaces_and_slashes_are_refused(self, project, bad):
        user = _user(project, *_crud("shot"))

        resp = _client(user).post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": bad, "name": "n"},
            format="json",
        )

        assert resp.status_code == 400
        assert "code" in resp.json()

    def test_surrounding_space_is_trimmed(self, project):
        user = _user(project, *_crud("shot"))

        resp = _client(user).post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "  sh010 ", "name": "n"},
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert Shot.objects.get(id=resp.json()["id"]).code == "SH010"


class TestUpdateAndFreeze:
    def test_a_code_cannot_be_changed_to_one_in_use_in_any_case(self, project):
        ShotFactory.create(project=project, code="TAKEN")
        shot = ShotFactory.create(project=project, code="MINE")
        user = _user(project, *_crud("shot"))

        resp = _client(user).patch(f"/api/v1/shots/{shot.id}/", {"code": "taken"}, format="json")

        assert resp.status_code == 400

    def test_a_shot_without_versions_can_be_renamed_by_update(self, project):
        shot = ShotFactory.create(project=project, code="OLD1")
        user = _user(project, *_crud("shot"))

        resp = _client(user).patch(f"/api/v1/shots/{shot.id}/", {"code": "new1"}, format="json")

        assert resp.status_code == 200, resp.json()
        shot.refresh_from_db()
        assert shot.code == "NEW1"

    @pytest.mark.parametrize("name", ["shot", "asset"])
    def test_the_code_freezes_once_a_version_exists(self, project, name):
        model, factory = FACTORIES[name]
        record = factory.create(project=project, code="FROZEN1")
        VersionFactory.create(project=project, code="V1", **{name: record})
        user = _user(project, *_crud(name))

        resp = _client(user).patch(
            f"/api/v1/{name}s/{record.id}/", {"code": "other"}, format="json"
        )

        assert resp.status_code == 400
        assert "rename-code" in str(resp.json()["code"])
        record.refresh_from_db()
        assert record.code == "FROZEN1"

    def test_writing_a_frozen_code_back_is_not_a_change(self, project):
        shot = ShotFactory.create(project=project, code="Mixed1")  # stored as given, e.g. legacy
        VersionFactory.create(project=project, code="V1", shot=shot)
        user = _user(project, *_crud("shot"))

        resp = _client(user).patch(
            f"/api/v1/shots/{shot.id}/", {"code": "MIXED1", "name": "Renamed"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        shot.refresh_from_db()
        assert (shot.code, shot.name) == ("Mixed1", "Renamed")

    def test_sequences_and_tasks_are_not_frozen(self, project):
        sequence = SequenceFactory.create(project=project, code="SQ1")
        user = _user(project, *_crud("sequence"))

        resp = _client(user).patch(
            f"/api/v1/sequences/{sequence.id}/", {"code": "sq2"}, format="json"
        )

        assert resp.status_code == 200, resp.json()


class TestRenameCode:
    def test_it_needs_the_rename_code(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        plain = _user(project, *_crud("shot"))

        resp = _client(plain).post(
            f"/api/v1/shots/{shot.id}/rename-code/", {"code": "S2"}, format="json"
        )

        assert resp.status_code == 403

    @pytest.mark.parametrize("name", ["shot", "asset"])
    def test_it_renames_a_frozen_code_and_the_copies(self, project, name):
        model, factory = FACTORIES[name]
        record = factory.create(project=project, code="OLD9")
        version = VersionFactory.create(
            project=project,
            code="V1",
            entity_type=model.__name__,
            entity_id=str(record.id),
            entity_code="OLD9",
            **{name: record},
        )
        task = TaskFactory.create(
            project=project,
            code="T1",
            entity_type=model.__name__,
            entity_id=str(record.id),
            entity_code="OLD9",
        )
        other_task = TaskFactory.create(project=project, code="T2", entity_code="OLD9")
        admin = _user(project, f"{name}.view", "production.code.rename")

        resp = _client(admin).post(
            f"/api/v1/{name}s/{record.id}/rename-code/", {"code": "new9"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        for row in (record, version, task, other_task):
            row.refresh_from_db()
        assert record.code == "NEW9"
        assert version.entity_code == task.entity_code == "NEW9"
        assert other_task.entity_code == "OLD9"  # not this record's task
        change = ChangeLog.objects.filter(
            target_type=model.__name__, target_id=str(record.id)
        ).last()
        assert change is not None and "code" in change.changed_fields

    def test_it_refuses_a_taken_code_and_bad_format(self, project):
        ShotFactory.create(project=project, code="TAKEN")
        shot = ShotFactory.create(project=project, code="S1")
        admin = _user(project, "shot.view", "production.code.rename")
        client = _client(admin)
        url = f"/api/v1/shots/{shot.id}/rename-code/"

        assert client.post(url, {"code": "taken"}, format="json").status_code == 400
        assert client.post(url, {"code": "a b"}, format="json").status_code == 400
        assert client.post(url, {"code": ""}, format="json").status_code == 400
        assert client.post(url, {"code": "ok", "extra": 1}, format="json").status_code == 400


def _minimal(name, project):
    """Fields a row of ``name`` needs when created without its factory."""
    base = {"project": project}
    if name == "shot":
        return {**base, "name": "n"}
    if name == "sequence":
        return {**base, "name": "n"}
    if name == "asset":
        return {**base, "name": "n"}
    if name == "task":
        return {**base, "title": "t"}
    if name == "version":
        return base
    return {**base, "name": "n", "season_number": 1, "episode_number": 1}
