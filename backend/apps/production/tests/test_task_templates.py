"""
Task templates (WP D3, DECISIONS D-27): who may write which, what applying does, and that it is
idempotent and race-free.
"""

from __future__ import annotations

import threading
import uuid

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.models import MasterTaskType
from apps.production.models import ProjectMembership, Task, TaskTemplate
from apps.production.services.task_template import TaskTemplateService
from apps.production.tests.factories import AssetFactory, ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/task-templates/"
ADMIN = (
    "tasktemplate.view", "tasktemplate.create", "tasktemplate.update", "tasktemplate.delete",
    "tasktemplate.manage_studio", "task.create",
)  # fmt: skip


def _client(*projects, codes=ADMIN):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return user, api


@pytest.fixture
def anim():
    return MasterTaskType.objects.create(code="ANIM", name="Animation", department_name="Animation")


@pytest.fixture
def comp():
    return MasterTaskType.objects.create(
        code="COMP", name="Compositing", department_name="Compositing"
    )


@pytest.fixture
def project():
    return ProjectFactory.create(code="TPL1")


def _body(**extra):
    return {
        "name": "Shot basics",
        "entity_type": "Shot",
        "items": [
            {"task_type_id": "anim", "name": "Animation", "default_bid_hours": "12.50"},
            {"task_type_id": "COMP", "name": "Comp", "default_bid_hours": 6},
        ],
        **extra,
    }


class TestWriting:
    def test_a_project_template_with_items_by_type_code(self, project, anim, comp):
        _, api = _client(project)

        resp = api.post(URL, _body(project_id=str(project.id)), format="json")

        assert resp.status_code == 201, resp.json()
        data = resp.json()
        assert (data["scope"], data["project_code"], data["entity_type"]) == (
            "project",
            "TPL1",
            "Shot",
        )
        assert [
            (i["task_type_code"], i["name"], i["default_bid_hours"]) for i in data["items"]
        ] == [
            ("ANIM", "Animation", "12.50"),
            ("COMP", "Comp", "6.00"),
        ]

    def test_a_project_the_caller_is_not_in_reads_like_a_missing_one(self, project, anim, comp):
        other = ProjectFactory.create(code="TPL2")
        _, api = _client(project)

        for ref in (str(other.id), "TPL2", str(uuid.uuid4())):
            resp = api.post(URL, _body(project_id=ref), format="json")
            assert resp.status_code == 400, (ref, resp.status_code)
            assert resp.json()["project_id"] == ["Unknown project."]
        assert not TaskTemplate.objects.exists()

    def test_studio_templates_need_the_studio_code_and_everyone_with_view_sees_them(
        self, project, anim, comp
    ):
        _, no_studio = _client(project, codes=("tasktemplate.view", "tasktemplate.create"))
        _, studio = _client(codes=ADMIN)

        assert no_studio.post(URL, _body(), format="json").status_code == 403
        created = studio.post(URL, _body(), format="json")
        assert created.status_code == 201 and created.json()["scope"] == "studio"
        _, reader = _client(codes=("tasktemplate.view",))
        assert [row["name"] for row in reader.get(URL).json()["results"]] == ["Shot basics"]

    def test_project_templates_are_for_members_only(self, project, anim, comp):
        _, member = _client(project)
        _, outsider = _client(ProjectFactory.create(code="TPL3"))
        made = member.post(URL, _body(project_id=str(project.id)), format="json").json()

        assert [r["id"] for r in member.get(URL).json()["results"]] == [made["id"]]
        assert outsider.get(URL).json()["results"] == []
        assert outsider.get(f"{URL}{made['id']}/").status_code == 404

    def test_names_are_unique_per_scope_and_kind(self, project, anim, comp):
        _, api = _client(project)
        assert api.post(URL, _body(), format="json").status_code == 201

        again = api.post(URL, _body(name="SHOT BASICS"), format="json")
        project_copy = api.post(URL, _body(project_id=str(project.id)), format="json")
        other_kind = api.post(URL, _body(entity_type="Asset"), format="json")

        assert again.status_code == 400 and "name" in again.json()
        assert project_copy.status_code == 201  # same name, different scope
        assert other_kind.status_code == 201  # same name, different kind

    def test_bad_bodies_are_refused_and_nothing_is_stored(self, project, anim):
        _, api = _client(project)
        bad = [
            _body(items=[{"task_type_id": "NOPE", "name": "x"}]),
            _body(
                items=[{"task_type_id": "anim", "name": "x"}, {"task_type_id": "ANIM", "name": "X"}]
            ),
            _body(items=[{"task_type_id": "anim", "name": "x", "default_bid_hours": -1}]),
            _body(items=[{"task_type_id": "anim", "name": "x", "extra": 1}]),
            _body(entity_type="Sequence"),
            _body(surprise=True),
            {"entity_type": "Shot"},
        ]

        statuses = [api.post(URL, body, format="json").status_code for body in bad]

        assert statuses == [400] * len(bad)
        assert not TaskTemplate.objects.exists()

    def test_an_archived_task_type_cannot_be_used(self, project, anim):
        MasterTaskType.objects.filter(pk=anim.pk).update(status="archived")
        _, api = _client(project)

        resp = api.post(URL, _body(items=[{"task_type_id": "ANIM", "name": "x"}]), format="json")

        assert resp.status_code == 400

    def test_update_replaces_the_items_and_keeps_matching_ones(self, project, anim, comp):
        _, api = _client(project)
        made = api.post(URL, _body(project_id=str(project.id)), format="json").json()
        first_id = made["items"][0]["id"]

        resp = api.patch(
            f"{URL}{made['id']}/",
            {
                "items": [
                    {
                        "task_type_id": "ANIM",
                        "name": "animation",
                        "default_bid_hours": 20,
                        "order": 5,
                    }
                ]
            },
            format="json",
        )

        assert resp.status_code == 200, resp.json()
        items = resp.json()["items"]
        assert [(i["task_type_code"], i["default_bid_hours"], i["order"]) for i in items] == [
            ("ANIM", "20.00", 5)
        ]
        assert items[0]["id"] == first_id  # the matching item was updated, not recreated

    def test_update_can_rename_and_switch_off_without_touching_items(self, project, anim, comp):
        _, api = _client(project)
        made = api.post(URL, _body(project_id=str(project.id)), format="json").json()

        resp = api.patch(
            f"{URL}{made['id']}/", {"name": "Renamed", "is_active": False}, format="json"
        )

        assert resp.status_code == 200
        assert (resp.json()["name"], resp.json()["is_active"], len(resp.json()["items"])) == (
            "Renamed",
            False,
            2,
        )
        assert (
            api.patch(f"{URL}{made['id']}/", {"project_id": "x"}, format="json").status_code == 400
        )

    def test_delete_archives_and_studio_ones_need_the_studio_code(self, project, anim, comp):
        _, studio = _client(codes=ADMIN)
        _, narrow = _client(
            project, codes=("tasktemplate.view", "tasktemplate.delete", "tasktemplate.update")
        )
        made = studio.post(URL, _body(), format="json").json()

        assert narrow.delete(f"{URL}{made['id']}/").status_code == 403
        assert narrow.patch(f"{URL}{made['id']}/", {"name": "x"}, format="json").status_code == 403
        assert studio.delete(f"{URL}{made['id']}/").status_code == 204
        assert studio.get(URL).json()["results"] == []
        assert TaskTemplate.all_objects.get(pk=made["id"]).is_deleted is True

    def test_the_list_filters_and_does_not_query_per_template(
        self, project, anim, comp, django_assert_max_num_queries
    ):
        _, api = _client(project)
        for index in range(5):
            api.post(
                URL,
                _body(name=f"T{index}", project_id=str(project.id) if index % 2 else None),
                format="json",
            )

        with django_assert_max_num_queries(14):
            rows = api.get(URL).json()["results"]
        assert len(rows) == 5
        assert len(api.get(f"{URL}?studio=true").json()["results"]) == 3
        assert len(api.get(f"{URL}?project_id={project.code}").json()["results"]) == 2
        assert len(api.get(f"{URL}?entity_type=asset").json()["results"]) == 0


class TestApplying:
    def _template(self, api, project=None, **extra):
        body = _body(**extra)
        if project is not None:
            body["project_id"] = str(project.id)
        return api.post(URL, body, format="json").json()

    def test_it_creates_one_task_per_item_and_a_second_apply_adds_nothing(
        self, project, anim, comp
    ):
        shot = ShotFactory.create(project=project, code="S1", name="Opening")
        _, api = _client(project)
        template = self._template(api)

        first = api.post(
            f"{URL}{template['id']}/apply/",
            {"project_id": str(project.id), "entity_id": "s1"},
            format="json",
        )
        second = api.post(
            f"{URL}{template['id']}/apply/",
            {"project_id": "TPL1", "entity_id": str(shot.id)},
            format="json",
        )

        assert first.status_code == 201, first.json()
        assert [t["code"] for t in first.json()["created"]] == ["S1_ANIM", "S1_COMP"]
        assert second.status_code == 200 and second.json()["created"] == []
        assert len(second.json()["existing"]) == 2
        tasks = {t.title: t for t in Task.objects.filter(project=project)}
        assert set(tasks) == {"Animation", "Comp"}
        anim_task = tasks["Animation"]
        assert (anim_task.entity_type, anim_task.entity_id, anim_task.entity_code, anim_task.entity_name) == (
            "Shot", str(shot.id), "S1", "Opening",
        )  # fmt: skip
        assert (anim_task.task_type_id, anim_task.department, str(anim_task.estimated_hours)) == (
            anim.id,
            "Animation",
            "12.50",
        )

    def test_a_missing_task_is_added_and_a_clash_in_codes_gets_a_suffix(self, project, anim, comp):
        shot = ShotFactory.create(project=project, code="S1")
        _, api = _client(project)
        body = _body(
            items=[
                {"task_type_id": "anim", "name": "Block"},
                {"task_type_id": "anim", "name": "Polish"},
            ]
        )
        template = api.post(URL, {**body, "project_id": str(project.id)}, format="json").json()

        applied = api.post(f"{URL}{template['id']}/apply/", {"entity_id": "S1"}, format="json")
        assert [t["code"] for t in applied.json()["created"]] == ["S1_ANIM", "S1_ANIM_2"]

        Task.objects.filter(project=project, title="Polish").update(
            is_deleted=True
        )  # archived by hand
        again = api.post(f"{URL}{template['id']}/apply/", {"entity_id": "S1"}, format="json")
        assert again.status_code == 201 and [t["title"] for t in again.json()["created"]] == [
            "Polish"
        ]
        assert Task.objects.filter(project=project, entity_id=str(shot.id)).count() == 2

    def test_the_entity_must_be_a_live_one_of_the_right_kind_in_the_project(
        self, project, anim, comp
    ):
        other = ProjectFactory.create(code="TPL4")
        ShotFactory.create(project=other, code="OTHER")
        AssetFactory.create(project=project, code="ROCK")
        shot = ShotFactory.create(project=project, code="S1")
        _, api = _client(project, other)
        template = self._template(api, project)

        for ref in (
            "OTHER",
            str(uuid.uuid4()),
            "nope",
            "ROCK",
        ):  # foreign, missing, unknown, the wrong kind
            resp = api.post(f"{URL}{template['id']}/apply/", {"entity_id": ref}, format="json")
            assert resp.status_code == 400 and resp.json()["entity_id"] == ["Unknown shot."], ref
        Task.objects.all().delete()
        type(shot).objects.filter(pk=shot.pk).update(is_deleted=True)
        assert (
            api.post(
                f"{URL}{template['id']}/apply/", {"entity_id": "S1"}, format="json"
            ).status_code
            == 400
        )
        assert not Task.objects.exists()

    def test_a_project_template_applies_only_in_its_own_project(self, project, anim, comp):
        other = ProjectFactory.create(code="TPL5")
        ShotFactory.create(project=other, code="S1")
        _, api = _client(project, other)
        template = self._template(api, project)

        resp = api.post(
            f"{URL}{template['id']}/apply/",
            {"project_id": "TPL5", "entity_id": "S1"},
            format="json",
        )

        assert resp.status_code == 400 and resp.json()["project_id"] == ["Unknown project."]

    def test_a_studio_template_needs_a_project_and_membership_of_it(self, project, anim, comp):
        other = ProjectFactory.create(code="TPL6")
        ShotFactory.create(project=project, code="S1")
        ShotFactory.create(project=other, code="S1")
        _, api = _client(project)
        template = self._template(api)

        no_project = api.post(f"{URL}{template['id']}/apply/", {"entity_id": "S1"}, format="json")
        not_member = api.post(
            f"{URL}{template['id']}/apply/",
            {"project_id": "TPL6", "entity_id": "S1"},
            format="json",
        )
        member = api.post(
            f"{URL}{template['id']}/apply/",
            {"project_id": "TPL1", "entity_id": "S1"},
            format="json",
        )

        assert no_project.status_code == not_member.status_code == 400
        assert member.status_code == 201

    def test_a_switched_off_template_does_not_apply(self, project, anim, comp):
        ShotFactory.create(project=project, code="S1")
        _, api = _client(project)
        template = self._template(api, project, is_active=False)

        resp = api.post(f"{URL}{template['id']}/apply/", {"entity_id": "S1"}, format="json")

        assert resp.status_code == 400 and not Task.objects.exists()

    def test_an_asset_template_applies_to_assets(self, project, anim, comp):
        asset = AssetFactory.create(project=project, code="ROCK", name="Rock")
        _, api = _client(project)
        template = self._template(api, project, entity_type="Asset", name="Asset basics")

        resp = api.post(f"{URL}{template['id']}/apply/", {"entity_id": "rock"}, format="json")

        assert resp.status_code == 201
        assert Task.objects.filter(entity_type="Asset", entity_id=str(asset.id)).count() == 2

    def test_applying_needs_task_create_as_well(self, project, anim, comp):
        ShotFactory.create(project=project, code="S1")
        _, admin = _client(project)
        template = self._template(admin, project)
        _, viewer = _client(project, codes=("tasktemplate.view",))

        assert (
            viewer.post(
                f"{URL}{template['id']}/apply/", {"entity_id": "S1"}, format="json"
            ).status_code
            == 403
        )
        assert not Task.objects.exists()


class TestCopying:
    def test_a_studio_template_copied_to_a_project_is_independent(self, project, anim, comp):
        _, api = _client(project)
        studio = api.post(URL, _body(), format="json").json()

        copy = api.post(
            f"{URL}{studio['id']}/copy-to-project/", {"project_id": "TPL1"}, format="json"
        )

        assert copy.status_code == 201, copy.json()
        assert copy.json()["scope"] == "project" and len(copy.json()["items"]) == 2
        api.patch(
            f"{URL}{copy.json()['id']}/",
            {"items": [{"task_type_id": "ANIM", "name": "Only"}]},
            format="json",
        )
        assert (
            len(api.get(f"{URL}{studio['id']}/").json()["items"]) == 2
        )  # the studio one is untouched

    def test_a_name_clash_in_the_target_is_a_400_and_a_new_name_fixes_it(self, project, anim, comp):
        _, api = _client(project)
        studio = api.post(URL, _body(), format="json").json()
        assert (
            api.post(
                f"{URL}{studio['id']}/copy-to-project/", {"project_id": "TPL1"}, format="json"
            ).status_code
            == 201
        )

        again = api.post(
            f"{URL}{studio['id']}/copy-to-project/", {"project_id": "TPL1"}, format="json"
        )
        renamed = api.post(
            f"{URL}{studio['id']}/copy-to-project/",
            {"project_id": "TPL1", "name": "Mine"},
            format="json",
        )

        assert again.status_code == 400 and renamed.status_code == 201

    def test_the_target_must_be_the_callers_and_the_code_is_needed(self, project, anim, comp):
        other = ProjectFactory.create(code="TPL7")
        _, api = _client(project)
        studio = api.post(URL, _body(), format="json").json()
        _, reader = _client(project, codes=("tasktemplate.view",))

        assert (
            api.post(
                f"{URL}{studio['id']}/copy-to-project/", {"project_id": "TPL7"}, format="json"
            ).status_code
            == 400
        )
        assert (
            reader.post(
                f"{URL}{studio['id']}/copy-to-project/", {"project_id": "TPL1"}, format="json"
            ).status_code
            == 403
        )
        assert other.pk


@pytest.mark.django_db(transaction=True)
def test_two_applies_at_once_create_each_task_once(anim, comp):
    project = ProjectFactory.create(code="TPLRACE")
    shot = ShotFactory.create(project=project, code="S1")
    admin = UserFactory.create(is_superuser=True, is_staff=True)
    template = TaskTemplateService.create(
        user=admin,
        project=project,
        data={"name": "Basics", "description": "", "entity_type": "Shot", "is_active": True},
        items=[
            {"task_type": anim, "name": "Animation", "default_bid_hours": 1},
            {"task_type": comp, "name": "Comp", "default_bid_hours": 1},
        ],
    )
    start = threading.Barrier(2)
    outcomes: list[tuple[int, int]] = []

    def run():
        try:
            start.wait()
            result = TaskTemplateService.apply(user=admin, template=template, entity=shot)
            outcomes.append((len(result["created"]), len(result["existing"])))
        finally:
            connection.close()

    threads = [threading.Thread(target=run) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(outcomes) == [(0, 2), (2, 0)], outcomes
    assert Task.objects.filter(project=project).count() == 2
