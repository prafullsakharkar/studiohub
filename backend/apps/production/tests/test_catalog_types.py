"""
Task types and asset types from the masterdata catalog, and the parent-asset checks (D-27).
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.models import MasterAssetType, MasterTaskType
from apps.production.models import Asset, ProjectMembership, Task
from apps.production.tests.factories import AssetFactory, ProjectFactory, TaskFactory

pytestmark = pytest.mark.django_db

CODES = ("task.view", "task.create", "task.update", "asset.view", "asset.create", "asset.update")


def _client(*projects):
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def project():
    return ProjectFactory.create(code="CAT1")


@pytest.fixture
def anim():
    return MasterTaskType.objects.create(code="ANIM", name="Animation", department_name="Animation")


class TestTaskType:
    def _create(self, api, project, **extra):
        return api.post(
            "/api/v1/tasks/",
            {
                "project_id": str(project.id),
                "title": "Block",
                "code": "T1",
                "entity_type": "Shot",
                **extra,
            },
            format="json",
        )

    def test_a_task_takes_a_type_by_code_and_the_department_follows_when_blank(self, project, anim):
        api = _client(project)

        resp = self._create(api, project, task_type_id="anim")

        assert resp.status_code == 201, resp.json()
        task = Task.objects.get(code="T1")
        detail = api.get(f"/api/v1/tasks/{task.id}/").json()
        assert (detail["task_type_code"], detail["task_type_name"]) == ("ANIM", "Animation")
        assert (task.task_type_id, task.department) == (anim.id, "Animation")

    def test_a_typed_department_is_kept(self, project, anim):
        api = _client(project)

        self._create(api, project, task_type_id=str(anim.id), department="Layout")

        assert Task.objects.get(code="T1").department == "Layout"

    @pytest.mark.parametrize("ref", ["NOPE", "00000000-0000-0000-0000-000000000000", "a b"])
    def test_an_unknown_type_is_a_400_and_nothing_is_created(self, project, anim, ref):
        api = _client(project)

        resp = self._create(api, project, task_type_id=ref)

        assert resp.status_code == 400 and resp.json()["task_type_id"] == ["Unknown task type."]
        assert not Task.objects.exists()

    def test_an_archived_type_is_unknown(self, project, anim):
        MasterTaskType.objects.filter(pk=anim.pk).update(status="archived")

        assert self._create(_client(project), project, task_type_id="ANIM").status_code == 400

    def test_it_can_be_changed_and_cleared_and_older_tasks_have_none(self, project, anim):
        comp = MasterTaskType.objects.create(code="COMP", name="Compositing")
        old = TaskFactory.create(project=project, code="OLD")
        api = _client(project)
        assert old.task_type_id is None
        assert api.get(f"/api/v1/tasks/{old.id}/").json()["task_type_id"] is None

        changed = api.patch(f"/api/v1/tasks/{old.id}/", {"task_type_id": "comp"}, format="json")
        assert changed.status_code == 200
        assert Task.objects.get(pk=old.pk).task_type_id == comp.id
        assert api.get(f"/api/v1/tasks/{old.id}/").json()["task_type_code"] == "COMP"

        cleared = api.patch(f"/api/v1/tasks/{old.id}/", {"task_type_id": ""}, format="json")
        assert cleared.status_code == 200
        assert Task.objects.get(pk=old.pk).task_type_id is None
        assert api.get(f"/api/v1/tasks/{old.id}/").json()["task_type_id"] is None
        assert comp.pk

    def test_the_task_list_does_not_query_per_task(
        self, project, anim, django_assert_max_num_queries
    ):
        api = _client(project)
        for index in range(6):
            self._create(api, project, task_type_id="ANIM", code=f"T{index}")

        with django_assert_max_num_queries(25):
            assert len(api.get("/api/v1/tasks/").json()["results"]) == 6


class TestAssetType:
    def _create(self, api, project, code="A1", **extra):
        return api.post(
            "/api/v1/assets/",
            {
                "project_id": str(project.id),
                "code": code,
                "name": code,
                "category": "Prop",
                **extra,
            },
            format="json",
        )

    def test_an_asset_takes_a_type_and_keeps_its_category(self, project):
        kind = MasterAssetType.objects.create(code="HERO", name="Hero prop")
        api = _client(project)

        resp = self._create(api, project, asset_type_id="hero")

        assert resp.status_code == 201, resp.json()
        asset = Asset.objects.get(code="A1")
        assert asset.asset_type_id == kind.id
        detail = api.get(f"/api/v1/assets/{asset.id}/").json()
        assert (detail["asset_type_code"], detail["category"]) == ("HERO", "Prop")

    def test_unknown_and_archived_types_are_a_400(self, project):
        MasterAssetType.objects.create(code="OLD", name="Old", status="archived")
        api = _client(project)

        for ref in ("NOPE", "OLD", "00000000-0000-0000-0000-000000000000"):
            resp = self._create(api, project, code=f"A-{ref[:3]}", asset_type_id=ref)
            assert resp.status_code == 400 and resp.json()["asset_type_id"] == [
                "Unknown asset type."
            ], ref
        assert not Asset.objects.exists()


class TestParentAsset:
    def _patch(self, api, asset, parent):
        return api.patch(
            f"/api/v1/assets/{asset.id}/", {"parent_asset": str(parent.id)}, format="json"
        )

    def test_a_parent_in_the_same_project_is_fine(self, project):
        parent, child = (
            AssetFactory.create(project=project, code="P"),
            AssetFactory.create(project=project, code="C"),
        )
        api = _client(project)

        resp = self._patch(api, child, parent)

        assert resp.status_code == 200, resp.json()
        assert Asset.objects.get(pk=child.pk).parent_asset_id == parent.id

    def test_a_parent_in_another_project_reads_like_a_missing_one(self, project):
        other = ProjectFactory.create(code="CAT2")
        member_only = AssetFactory.create(project=other, code="FOREIGN")
        outside = AssetFactory.create(project=ProjectFactory.create(code="CAT3"), code="HIDDEN")
        child = AssetFactory.create(project=project, code="C")
        api = _client(project, other)

        in_my_other_project = self._patch(api, child, member_only)
        not_mine_at_all = self._patch(api, child, outside)

        assert in_my_other_project.status_code == not_mine_at_all.status_code == 400
        assert "parent" in str(in_my_other_project.json()) and "parent" in str(
            not_mine_at_all.json()
        )
        assert Asset.objects.get(pk=child.pk).parent_asset_id is None

    def test_an_asset_cannot_be_its_own_ancestor(self, project):
        a, b, c = (AssetFactory.create(project=project, code=code) for code in ("A", "B", "C"))
        api = _client(project)
        assert self._patch(api, b, a).status_code == 200  # a is b's parent
        assert self._patch(api, c, b).status_code == 200  # b is c's parent

        itself = self._patch(api, a, a)
        loop = self._patch(api, a, c)  # a -> c -> b -> a

        assert itself.status_code == loop.status_code == 400
        assert "ancestor" in str(loop.json())
        assert Asset.objects.get(pk=a.pk).parent_asset_id is None

    def test_create_with_a_parent_checks_the_project_too(self, project):
        foreign = AssetFactory.create(project=ProjectFactory.create(code="CAT4"), code="FOREIGN")
        api = _client(project)

        resp = api.post(
            "/api/v1/assets/",
            {
                "project_id": str(project.id),
                "code": "N1",
                "name": "N",
                "category": "Prop",
                "parent_asset": str(foreign.id),
            },
            format="json",
        )

        assert resp.status_code == 400 and not Asset.objects.filter(code="N1").exists()
