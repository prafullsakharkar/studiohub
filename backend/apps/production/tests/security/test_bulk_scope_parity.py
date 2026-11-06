"""
CR-46: a bulk route never sees or writes more than the single route allows.

Members narrowed to a show, to a department, and external (vendor) members get 404 on a single
PATCH of a record outside their reach; the bulk routes must answer ``not_found`` for the same id
and leave the row as it is. Bulk create files rows under the caller's show like a single create,
bulk update runs the single update's chain (episode rule, show), and an existence answer does not
hand out a row the caller may not see.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import ProjectMembership, Sequence, Shot, Task
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    ShowFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


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


def _post(client, path, body):
    response = client.post(f"{API}/{path}", body, format="json")
    assert response.status_code == 200, response.content
    return response.json()


@pytest.fixture
def world():
    project = ProjectFactory(workflow_type="standard")
    show_a, show_b = ShowFactory(project=project), ShowFactory(project=project)
    inside = ShotFactory(project=project, show=show_a, description="orig")
    outside = ShotFactory(project=project, show=show_b, description="orig")
    # The department member reaches ``inside`` through its Comp task; the vendor reaches nothing.
    Task.objects.create(
        project=project,
        shot=inside,
        title="comp",
        code="T1",
        department="Comp",
        status="Not Started",
        priority="Medium",
    )
    return {
        "project": project,
        "show_a": show_a,
        "show_b": show_b,
        "inside": inside,
        "outside": outside,
    }


NARROWINGS = {
    "show": lambda w: {"show": w["show_a"]},
    "department": lambda w: {"department": "Comp"},
    "vendor": lambda w: {"vendor_id": "VEND1"},
}


@pytest.fixture(params=sorted(NARROWINGS))
def narrowed(request, world):
    return _client(_member(world["project"], **NARROWINGS[request.param](world)))


class TestOutOfReachRows:
    def test_single_patch_is_404_and_bulk_update_is_not_found(self, narrowed, world):
        outside = world["outside"]
        assert (
            narrowed.patch(
                f"{API}/shots/{outside.pk}/", {"description": "x"}, format="json"
            ).status_code
            == 404
        )

        body = _post(
            narrowed,
            "shots/bulk-update/",
            {"items": [{"id": str(outside.pk), "description": "bulk"}]},
        )

        assert body["results"][0]["status"] == "not_found"
        assert body["failed"] == 1
        outside.refresh_from_db()
        assert outside.description == "orig"

    def test_bulk_archive_does_not_reach_the_row(self, narrowed, world):
        outside = world["outside"]
        body = _post(narrowed, "shots/bulk-archive/", {"ids": [str(outside.pk)]})
        assert body["results"][0]["status"] == "not_found"
        assert Shot.objects.filter(pk=outside.pk).exists()

    def test_bulk_restore_does_not_reach_the_row(self, narrowed, world):
        outside = world["outside"]
        outside.delete()
        body = _post(narrowed, "shots/bulk-restore/", {"ids": [str(outside.pk)]})
        assert body["results"][0]["status"] == "not_found"
        assert Shot.all_objects.get(pk=outside.pk).is_deleted

    def test_existence_says_the_code_is_taken_but_not_which_row(self, narrowed, world):
        outside = world["outside"]
        body = _post(
            narrowed,
            "shots/check-existence/",
            {"project_id": str(world["project"].pk), "codes": [outside.code]},
        )
        assert body["items"][0]["state"] == "EXISTS"
        assert "existing_entity" not in body["items"][0]
        assert body["results"][0]["id"] is None

    def test_bulk_create_of_a_taken_code_does_not_name_the_row(self, narrowed, world):
        outside = world["outside"]
        body = _post(
            narrowed,
            "shots/bulk-create/",
            {"items": [{"project_id": str(world["project"].pk), "code": outside.code}]},
        )
        assert body["results"][0]["status"] == "exists"
        assert body["results"][0]["id"] is None

    def test_recover_does_not_reach_an_archived_row_out_of_reach(self, narrowed, world):
        outside = world["outside"]
        outside.delete()
        body = _post(
            narrowed,
            "shots/bulk-create/",
            {
                "project_id": str(world["project"].pk),
                "items": [{"code": outside.code, "action": "recover"}],
            },
        )
        assert body["results"][0]["status"] == "invalid"
        assert Shot.all_objects.get(pk=outside.pk).is_deleted


class TestRowsInReach:
    def test_show_bound_member_bulk_updates_their_own_shot(self, world):
        client = _client(_member(world["project"], show=world["show_a"]))
        inside = world["inside"]
        body = _post(
            client, "shots/bulk-update/", {"items": [{"id": str(inside.pk), "description": "bulk"}]}
        )
        assert body["results"][0]["status"] == "updated"
        inside.refresh_from_db()
        assert inside.description == "bulk"

    def test_department_member_bulk_updates_their_task(self, world):
        client = _client(_member(world["project"], department="Comp"))
        task = Task.objects.get(code="T1")
        body = _post(
            client, "tasks/bulk-update/", {"items": [{"id": str(task.pk), "description": "bulk"}]}
        )
        assert body["results"][0]["status"] == "updated"


class TestShowFiling:
    def test_bulk_create_files_the_row_under_the_callers_show(self, world):
        client = _client(_member(world["project"], show=world["show_a"]))
        body = _post(
            client,
            "shots/bulk-create/",
            {"items": [{"project_id": str(world["project"].pk), "code": "NEW1"}]},
        )
        assert body["results"][0]["status"] == "created"
        assert Shot.objects.get(code="NEW1").show_id == world["show_a"].pk

    def test_bulk_create_into_another_show_is_refused(self, world):
        client = _client(_member(world["project"], show=world["show_a"]))
        body = _post(
            client,
            "shots/bulk-create/",
            {
                "items": [
                    {
                        "project_id": str(world["project"].pk),
                        "code": "NEW2",
                        "show_id": str(world["show_b"].pk),
                    }
                ]
            },
        )
        assert body["results"][0]["status"] == "invalid"
        assert not Shot.all_objects.filter(code="NEW2").exists()

    def test_bulk_update_does_not_move_a_shot_to_another_show_even_for_a_full_member(self, world):
        # CR-48: the show decides who sees a row, so it is not bulk-updatable; the single route moves it.
        client = _client(_member(world["project"]))
        inside = world["inside"]
        body = _post(
            client,
            "shots/bulk-update/",
            {"items": [{"id": str(inside.pk), "show_id": str(world["show_b"].pk)}]},
        )
        assert body["results"][0]["status"] == "invalid"
        assert body["errors"] == [
            {"row": 0, "field": "show_id", "message": "This field cannot be changed in bulk."}
        ]
        inside.refresh_from_db()
        assert inside.show_id != world["show_b"].pk

    def test_bulk_update_cannot_move_a_shot_out_of_the_callers_show(self, world):
        client = _client(_member(world["project"], show=world["show_a"]))
        inside = world["inside"]
        body = _post(
            client,
            "shots/bulk-update/",
            {"items": [{"id": str(inside.pk), "show_id": str(world["show_b"].pk)}]},
        )
        assert body["results"][0]["status"] == "invalid"
        inside.refresh_from_db()
        assert inside.show_id == world["show_a"].pk


class TestUpdateRulesInBulk:
    """The D-12 chain used to be skipped by bulk update, which then failed with a 500."""

    def test_an_episode_on_a_standard_projects_sequence_is_a_row_error(self, admin_user):
        project = ProjectFactory(workflow_type="standard")
        episode = EpisodeFactory(project=project)
        sequence = SequenceFactory(project=project)
        body = _post(
            _client(admin_user),
            "sequences/bulk-update/",
            {"items": [{"id": str(sequence.pk), "episode_id": str(episode.pk)}]},
        )
        assert body["results"][0]["status"] == "invalid"
        assert "episode_id" in body["results"][0]["error"]
        sequence.refresh_from_db()
        assert sequence.episode_id is None

    def test_clearing_an_episodic_sequences_episode_is_a_row_error(self, admin_user):
        project = ProjectFactory(workflow_type="episodic")
        sequence = SequenceFactory(project=project, episode=EpisodeFactory(project=project))
        body = _post(
            _client(admin_user),
            "sequences/bulk-update/",
            {"items": [{"id": str(sequence.pk), "episode_id": ""}]},
        )
        assert body["results"][0]["status"] == "invalid"
        assert Sequence.objects.get(pk=sequence.pk).episode_id is not None

    def test_a_shot_episode_differing_from_its_sequence_is_a_row_error(self, admin_user):
        project = ProjectFactory(workflow_type="episodic")
        first, second = (
            EpisodeFactory(project=project, code="EPA"),
            EpisodeFactory(project=project, code="EPB"),
        )
        shot = ShotFactory(
            project=project, sequence=SequenceFactory(project=project, episode=first), episode=first
        )
        body = _post(
            _client(admin_user),
            "shots/bulk-update/",
            {"items": [{"id": str(shot.pk), "episode_id": str(second.pk)}]},
        )
        assert body["results"][0]["status"] == "invalid"
        assert "episode_id" in body["results"][0]["error"]
        shot.refresh_from_db()
        assert shot.episode_id == first.pk

    def test_moving_a_shot_to_a_sequence_by_code_takes_its_episode(self, admin_user):
        project = ProjectFactory(workflow_type="episodic")
        first, second = (
            EpisodeFactory(project=project, code="EPA"),
            EpisodeFactory(project=project, code="EPB"),
        )
        shot = ShotFactory(
            project=project, sequence=SequenceFactory(project=project, episode=first), episode=first
        )
        target = SequenceFactory(project=project, code="SQB", episode=second)
        body = _post(
            _client(admin_user),
            "shots/bulk-update/",
            {"items": [{"id": str(shot.pk), "sequence_id": "sqb"}]},
        )
        assert body["results"][0]["status"] == "updated"
        shot.refresh_from_db()
        assert (shot.sequence_id, shot.episode_id) == (target.pk, second.pk)
