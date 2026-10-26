"""
What a task is about (WP D2, DECISIONS D-28): a real link to one shot, asset or sequence of the
task's project, or to none; the old text columns follow it.
"""

from __future__ import annotations

import uuid

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, Task
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
)

pytestmark = pytest.mark.django_db

CODES = ("task.view", "task.create", "task.update")


def _client(*projects):
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _create(api, project, code="T1", **extra):
    return api.post(
        "/api/v1/tasks/",
        {"project_id": str(project.id), "title": "t", "code": code, **extra},
        format="json",
    )


@pytest.fixture
def project():
    return ProjectFactory.create(code="ENT1")


class TestNamingTheEntity:
    def test_a_shot_by_id_or_by_code_any_case(self, project):
        shot = ShotFactory.create(project=project, code="SH010", name="Opening")
        api = _client(project)

        by_id = _create(api, project, "T1", entity_type="Shot", entity_id=str(shot.id))
        by_code = _create(api, project, "T2", entity_type="shot", entity_id="sh010")

        assert by_id.status_code == by_code.status_code == 201, (by_id.json(), by_code.json())
        for code in ("T1", "T2"):
            task = Task.objects.get(code=code)
            assert task.shot_id == shot.id and task.asset_id is None and task.sequence_id is None
            assert (task.entity_type, task.entity_id, task.entity_code, task.entity_name) == (
                "Shot", str(shot.id), "SH010", "Opening",
            )  # fmt: skip

    def test_an_asset_and_a_sequence(self, project):
        asset = AssetFactory.create(project=project, code="ROCK")
        sequence = SequenceFactory.create(project=project, code="SQ1")
        api = _client(project)

        assert _create(api, project, "T1", entity_type="Asset", entity_id="rock").status_code == 201
        assert (
            _create(
                api, project, "T2", entity_type="Sequence", entity_id=str(sequence.id)
            ).status_code
            == 201
        )

        assert Task.objects.get(code="T1").asset_id == asset.id
        assert Task.objects.get(code="T2").sequence_id == sequence.id

    def test_the_link_is_in_the_responses(self, project):
        shot = ShotFactory.create(project=project, code="SH010")
        api = _client(project)
        _create(api, project, "T1", entity_type="Shot", entity_id="SH010")
        task = Task.objects.get(code="T1")

        detail = api.get(f"/api/v1/tasks/{task.id}/").json()

        assert (detail["shot_id"], detail["asset_id"], detail["sequence_id"]) == (
            str(shot.id),
            None,
            None,
        )
        assert (detail["entity_type"], detail["entity_code"]) == ("Shot", "SH010")

    @pytest.mark.parametrize(
        "body",
        [
            {},
            {"entity_type": "General"},
            {"entity_type": "Shot", "entity_id": ""},  # the old default: a type with no record
            {"entity_type": "Asset", "entity_id": ""},
        ],
    )
    def test_no_record_named_means_a_general_task(self, project, body):
        api = _client(project)

        assert _create(api, project, "T1", **body).status_code == 201

        task = Task.objects.get(code="T1")
        assert (task.shot_id, task.asset_id, task.sequence_id) == (None, None, None)
        assert (task.entity_type, task.entity_id) == ("General", "")

    def test_a_record_that_is_not_there_is_a_400_and_nothing_is_created(self, project):
        other = ProjectFactory.create(code="ENT2")
        foreign = ShotFactory.create(project=other, code="FOREIGN")
        archived = ShotFactory.create(project=project, code="OLD", is_deleted=True)
        asset = AssetFactory.create(project=project, code="ROCK")
        api = _client(project, other)
        attempts = [
            ("Shot", str(foreign.id)),  # another project
            ("Shot", "FOREIGN"),
            ("Shot", str(uuid.uuid4())),  # no such id
            ("Shot", "NOPE"),
            ("Shot", str(archived.id)),  # archived
            ("Shot", "ROCK"),  # an asset's code, asked for as a shot
            ("Shot", str(asset.id)),
        ]

        results = [
            _create(api, project, f"B{n}", entity_type=t, entity_id=i)
            for n, (t, i) in enumerate(attempts)
        ]

        assert [r.status_code for r in results] == [400] * len(attempts)
        assert {str(r.json()["entity_id"]) for r in results} == {"['Unknown shot.']"}
        assert not Task.objects.exists()

    def test_an_unknown_type_is_a_400(self, project):
        assert (
            _create(_client(project), project, entity_type="Banana", entity_id="x").status_code
            == 400
        )

    def test_an_id_with_no_type_has_always_meant_a_shot(self, project):
        shot = ShotFactory.create(project=project, code="SH010")

        assert _create(_client(project), project, entity_id="SH010").status_code == 201
        assert Task.objects.get(code="T1").shot_id == shot.id

    def test_the_derived_text_may_be_sent_if_it_agrees_and_is_a_400_if_not(self, project):
        ShotFactory.create(project=project, code="SH010", name="Opening")
        api = _client(project)

        ok = _create(
            api,
            project,
            "T1",
            entity_type="Shot",
            entity_id="SH010",
            entity_code="sh010",
            entity_name="Opening",
        )
        wrong = _create(
            api, project, "T2", entity_type="Shot", entity_id="SH010", entity_code="SH999"
        )
        invented = _create(api, project, "T3", entity_code="SH010")

        assert ok.status_code == 201
        assert wrong.status_code == 400 and "entity_code" in wrong.json()
        assert invented.status_code == 400  # a General task has no code to give
        assert list(Task.objects.values_list("code", flat=True)) == ["T1"]


class TestChanging:
    def _task(self, api, project, **entity):
        _create(api, project, "T1", **entity)
        return Task.objects.get(code="T1")

    def test_a_task_can_be_moved_to_another_record_and_cleared(self, project):
        a = ShotFactory.create(project=project, code="A")
        ShotFactory.create(project=project, code="B")
        rock = AssetFactory.create(project=project, code="ROCK")
        api = _client(project)
        task = self._task(api, project, entity_type="Shot", entity_id="A")

        moved = api.patch(f"/api/v1/tasks/{task.id}/", {"entity_id": "B"}, format="json")
        assert moved.status_code == 200, moved.json()
        task.refresh_from_db()
        assert (task.shot.code, task.entity_code, task.asset_id) == ("B", "B", None)

        switched = api.patch(
            f"/api/v1/tasks/{task.id}/",
            {"entity_type": "Asset", "entity_id": "ROCK"},
            format="json",
        )
        assert switched.status_code == 200
        task.refresh_from_db()
        assert (task.shot_id, task.asset_id, task.entity_type) == (None, rock.id, "Asset")

        cleared = api.patch(f"/api/v1/tasks/{task.id}/", {"entity_id": ""}, format="json")
        assert cleared.status_code == 200
        task.refresh_from_db()
        assert (task.shot_id, task.asset_id, task.entity_type, task.entity_id) == (
            None,
            None,
            "General",
            "",
        )
        assert a.pk

    def test_an_edit_that_does_not_touch_the_entity_keeps_it(self, project):
        shot = ShotFactory.create(project=project, code="A")
        api = _client(project)
        task = self._task(api, project, entity_type="Shot", entity_id="A")

        assert (
            api.patch(f"/api/v1/tasks/{task.id}/", {"title": "renamed"}, format="json").status_code
            == 200
        )

        task.refresh_from_db()
        assert (task.title, task.shot_id) == ("renamed", shot.id)

    def test_a_full_put_that_echoes_an_older_unlinked_task_still_goes_through(self, project):
        old = TaskFactory.create(
            project=project,
            code="OLD",
            entity_type="Shot",
            entity_id="mock-shot-9",
            entity_code="X9",
        )
        general = TaskFactory.create(
            project=project, code="GEN"
        )  # the old default: type Shot, no id
        api = _client(project)

        for task in (old, general):
            body = {
                "title": "kept",
                "code": task.code,
                "entity_type": task.entity_type,
                "entity_id": task.entity_id,
                "entity_code": task.entity_code,
                "entity_name": task.entity_name,
            }
            assert api.put(f"/api/v1/tasks/{task.id}/", body, format="json").status_code == 200, (
                task.code
            )
            task.refresh_from_db()
            assert (task.title, task.shot_id) == ("kept", None)
        assert (
            Task.objects.get(pk=old.pk).entity_id == "mock-shot-9"
        )  # the old text is left as it was

    def test_pointing_an_unlinked_task_at_nothing_real_is_refused(self, project):
        old = TaskFactory.create(
            project=project, code="OLD", entity_type="Shot", entity_id="mock-shot-9"
        )
        api = _client(project)

        resp = api.patch(f"/api/v1/tasks/{old.id}/", {"entity_id": "still-not-real"}, format="json")

        assert resp.status_code == 400 and resp.json()["entity_id"] == ["Unknown shot."]

    def test_another_projects_record_cannot_be_moved_to(self, project):
        other = ProjectFactory.create(code="ENT3")
        ShotFactory.create(project=other, code="FOREIGN")
        api = _client(project, other)
        task = self._task(api, project)

        assert (
            api.patch(
                f"/api/v1/tasks/{task.id}/",
                {"entity_type": "Shot", "entity_id": "FOREIGN"},
                format="json",
            ).status_code
            == 400
        )


class TestFiltersAndBulk:
    def test_filter_by_the_link_id_or_code(self, project):
        a, b = (
            ShotFactory.create(project=project, code="A"),
            ShotFactory.create(project=project, code="B"),
        )
        api = _client(project)
        _create(api, project, "T1", entity_type="Shot", entity_id="A")
        _create(api, project, "T2", entity_type="Shot", entity_id="B")
        _create(api, project, "T3")

        def codes(query):
            return sorted(r["code"] for r in api.get(f"/api/v1/tasks/?{query}").json()["results"])

        assert codes(f"shot_id={a.id}") == ["T1"]
        assert codes("shot_id=b") == ["T2"]
        assert codes("shot_id=nope") == []
        assert codes("entity_type=General") == ["T3"]
        assert b.pk

    def test_bulk_create_checks_each_item(self, project):
        ShotFactory.create(project=project, code="A")
        api = _client(project)

        resp = api.post(
            "/api/v1/tasks/bulk-create/",
            {"items": [
                {"project_id": str(project.id), "title": "ok", "code": "B1", "entity_type": "Shot", "entity_id": "A"},
                {"project_id": str(project.id), "title": "bad", "code": "B2", "entity_type": "Shot", "entity_id": "ZZZ"},
            ]},
            format="json",
        )  # fmt: skip

        assert [r["status"] for r in resp.json()["results"]] == ["created", "invalid"]
        assert Task.objects.get(code="B1").shot.code == "A"
        assert not Task.objects.filter(code="B2").exists()


class TestTheDatabase:
    def test_a_task_cannot_be_about_two_things(self, project):
        shot, asset = (
            ShotFactory.create(project=project, code="A"),
            AssetFactory.create(project=project, code="R"),
        )

        with pytest.raises(IntegrityError), transaction.atomic():
            Task.objects.create(project=project, title="t", code="X", shot=shot, asset=asset)

    def test_saving_with_a_link_copies_it_into_the_text(self, project):
        asset = AssetFactory.create(project=project, code="ROCK", name="Big rock")

        task = Task.objects.create(project=project, title="t", code="X", asset=asset)

        task.refresh_from_db()
        assert (task.entity_type, task.entity_id, task.entity_code, task.entity_name) == (
            "Asset", str(asset.id), "ROCK", "Big rock",
        )  # fmt: skip

    def test_a_save_that_leaves_the_link_alone_leaves_the_text_alone(self, project):
        shot = ShotFactory.create(project=project, code="A")
        task = Task.objects.create(project=project, title="t", code="X", shot=shot)
        Task.objects.filter(pk=task.pk).update(entity_code="STALE")
        task.refresh_from_db()

        task.title = "changed"
        task.save(update_fields=["title"])

        assert Task.objects.get(pk=task.pk).entity_code == "STALE"

    def test_a_linked_shot_asset_or_sequence_cannot_be_hard_deleted(self, project):
        shot = ShotFactory.create(project=project, code="A")
        Task.objects.create(project=project, title="t", code="X", shot=shot)

        with pytest.raises(ProtectedError):
            shot.hard_delete()
