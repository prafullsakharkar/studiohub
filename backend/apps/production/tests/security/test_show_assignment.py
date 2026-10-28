"""
Assigning a record to a show through the API (TPN review TM-002).

``show_id`` is accepted on create and update of episodes, sequences, shots and assets. It decides who
sees the record, so only a full project member, a platform administrator, or a member bound to a show
(for their own show) may set it, and the show must belong to the record's project.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import Asset, Episode, ProjectMembership, Sequence, Shot
from apps.production.tests.factories import (
    AssetFactory,
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    ShowFactory,
)

MODELS = {
    "shots": (Shot, ShotFactory),
    "assets": (Asset, AssetFactory),
    "sequences": (Sequence, SequenceFactory),
    "episodes": (Episode, EpisodeFactory),
}


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _member(project, **kwargs):
    user = UserFactory()
    grant_all_known_codes(user)
    ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist", **kwargs
    )
    return user


@pytest.fixture
def world(db):
    project = ProjectFactory()
    show_a, show_b = ShowFactory(project=project), ShowFactory(project=project)
    foreign_show = ShowFactory(project=ProjectFactory())
    return {
        "project": project,
        "show_a": show_a,
        "show_b": show_b,
        "foreign_show": foreign_show,
        "full": _member(project),
        "in_show_a": _member(project, show=show_a),
        "in_dept": _member(project, department="Comp"),
        "vendor": _member(project, vendor_id="vendor-x"),
        "admin": UserFactory(is_superuser=True, is_staff=True),
    }


def _patch(user, resource, record, show_id):
    return _client(user).patch(
        f"/api/v1/{resource}/{record.pk}/", {"show_id": show_id}, format="json"
    )


@pytest.mark.parametrize("resource", list(MODELS))
class TestFullMemberAssigns:
    def test_update_sets_the_show(self, world, resource):
        model, factory = MODELS[resource]
        record = factory(project=world["project"])

        response = _patch(world["full"], resource, record, str(world["show_b"].pk))

        assert response.status_code == 200, response.content
        assert model.objects.get(pk=record.pk).show_id == world["show_b"].pk

    def test_null_clears_it(self, world, resource):
        model, factory = MODELS[resource]
        record = factory(project=world["project"], show=world["show_a"])

        response = _patch(world["full"], resource, record, None)

        assert response.status_code == 200, response.content
        assert model.objects.get(pk=record.pk).show_id is None

    def test_a_show_of_another_project_is_unknown(self, world, resource):
        model, factory = MODELS[resource]
        record = factory(project=world["project"])

        response = _patch(world["full"], resource, record, str(world["foreign_show"].pk))

        assert response.status_code == 400, response.content
        assert "Unknown show" in response.content.decode()
        assert model.objects.get(pk=record.pk).show_id is None

    def test_a_malformed_id_is_a_400(self, world, resource):
        _model, factory = MODELS[resource]
        record = factory(project=world["project"])

        assert _patch(world["full"], resource, record, "not-a-uuid").status_code == 400

    def test_an_administrator_may_assign(self, world, resource):
        model, factory = MODELS[resource]
        record = factory(project=world["project"])

        response = _patch(world["admin"], resource, record, str(world["show_a"].pk))

        assert response.status_code == 200, response.content
        assert model.objects.get(pk=record.pk).show_id == world["show_a"].pk


class TestCreate:
    def test_a_full_member_can_create_into_a_show(self, world):
        response = _client(world["full"]).post(
            "/api/v1/shots/",
            {
                "project_id": str(world["project"].pk),
                "code": "NEW020",
                "name": "n",
                "show_id": str(world["show_b"].pk),
            },
            format="json",
        )

        assert response.status_code == 201, response.content
        assert Shot.objects.get(code="NEW020").show_id == world["show_b"].pk

    def test_creating_with_a_foreign_show_is_a_400_and_creates_nothing(self, world):
        response = _client(world["full"]).post(
            "/api/v1/shots/",
            {
                "project_id": str(world["project"].pk),
                "code": "NEW021",
                "name": "n",
                "show_id": str(world["foreign_show"].pk),
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert not Shot.objects.filter(code="NEW021").exists()

    def test_a_show_bound_member_creating_into_another_show_is_refused(self, world):
        response = _client(world["in_show_a"]).post(
            "/api/v1/shots/",
            {
                "project_id": str(world["project"].pk),
                "code": "NEW022",
                "name": "n",
                "show_id": str(world["show_b"].pk),
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert not Shot.objects.filter(code="NEW022").exists()

    def test_a_show_bound_member_without_show_id_still_gets_their_show(self, world):
        response = _client(world["in_show_a"]).post(
            "/api/v1/shots/",
            {"project_id": str(world["project"].pk), "code": "NEW023", "name": "n"},
            format="json",
        )

        assert response.status_code == 201, response.content
        assert Shot.objects.get(code="NEW023").show_id == world["show_a"].pk


class TestShowBoundMember:
    def test_may_file_into_their_own_show(self, world):
        shot = ShotFactory(project=world["project"], show=world["show_a"])

        response = _patch(world["in_show_a"], "shots", shot, str(world["show_a"].pk))

        assert response.status_code == 200, response.content

    def test_may_not_move_a_record_to_another_show(self, world):
        shot = ShotFactory(project=world["project"], show=world["show_a"])

        response = _patch(world["in_show_a"], "shots", shot, str(world["show_b"].pk))

        assert response.status_code == 400, response.content
        assert Shot.objects.get(pk=shot.pk).show_id == world["show_a"].pk

    def test_may_not_take_a_record_out_of_their_show(self, world):
        shot = ShotFactory(project=world["project"], show=world["show_a"])

        response = _patch(world["in_show_a"], "shots", shot, None)

        assert response.status_code == 403, response.content
        assert Shot.objects.get(pk=shot.pk).show_id == world["show_a"].pk


class TestOthersMayNotAssign:
    def test_a_department_member_is_refused(self, world):
        shot = ShotFactory(project=world["project"], show=world["show_a"])
        task_shot = shot
        # The department member must be able to see the record to attempt the change.
        from apps.production.models import Task

        Task.objects.create(
            project=world["project"],
            shot=task_shot,
            title="t",
            code="T-DEPT",
            department="Comp",
            status="Not Started",
            priority="Medium",
        )

        response = _patch(world["in_dept"], "shots", shot, str(world["show_b"].pk))

        assert response.status_code == 403, response.content
        assert Shot.objects.get(pk=shot.pk).show_id == world["show_a"].pk

    def test_an_external_member_is_refused(self, world):
        shot = ShotFactory(project=world["project"])

        response = _patch(world["vendor"], "shots", shot, str(world["show_a"].pk))

        assert response.status_code in (403, 404), response.content
        assert Shot.objects.get(pk=shot.pk).show_id is None


class TestResponses:
    def test_the_show_is_reported_after_assignment(self, world):
        shot = ShotFactory(project=world["project"])
        client = _client(world["full"])

        client.patch(
            f"/api/v1/shots/{shot.pk}/", {"show_id": str(world["show_a"].pk)}, format="json"
        )
        detail = client.get(f"/api/v1/shots/{shot.pk}/")

        assert detail.status_code == 200, detail.content
        assert str(detail.json()["show_id"]) == str(world["show_a"].pk)
