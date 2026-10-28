"""
Internal members narrowed to a show or a department (TPN review TM-002, ADR-0033 D2).

A membership with no show and no department is full and sees the project. One bound to a show sees
the records assigned to it (none of the unassigned ones); one naming a department sees that
department's tasks and what hangs off them; both together must hold.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes
from apps.production.models import (
    Asset,
    Episode,
    Media,
    ProjectMembership,
    Review,
    ReviewItem,
    Sequence,
    Shot,
    Task,
    Version,
)
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.tests.factories import (
    AssetFactory,
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    ShowFactory,
    TimelogFactory,
)


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


def _ids(client, path):
    response = client.get(path)
    assert response.status_code == 200, response.content
    body = response.json()
    rows = body["results"] if isinstance(body, dict) else body
    return {str(row["id"]) for row in rows}


def _task(project, shot, code, department, department_id=""):
    return Task.objects.create(
        project=project,
        shot=shot,
        title=code,
        code=code,
        department=department,
        department_id=department_id,
        status="Not Started",
        priority="Medium",
    )


def _version(project, task, code):
    return Version.objects.create(project=project, task=task, shot=task.shot, code=code)


@pytest.fixture
def world(db):
    project = ProjectFactory()
    show_a, show_b = ShowFactory(project=project), ShowFactory(project=project)

    shot_a1 = ShotFactory(project=project, show=show_a)
    shot_a2 = ShotFactory(project=project, show=show_a)
    shot_b = ShotFactory(project=project, show=show_b)
    shot_none = ShotFactory(project=project)

    asset_a = AssetFactory(project=project, show=show_a)
    asset_b = AssetFactory(project=project, show=show_b)
    sequence_a = SequenceFactory(project=project, show=show_a)
    sequence_b = SequenceFactory(project=project, show=show_b)
    episode_a = EpisodeFactory(project=project, show=show_a)
    episode_none = EpisodeFactory(project=project)

    t_a_comp = _task(project, shot_a1, "T-A-COMP", "Comp")
    t_a_anim = _task(project, shot_a2, "T-A-ANIM", "Anim", "d-anim")
    t_b_comp = _task(project, shot_b, "T-B-COMP", "Comp")
    t_none = _task(project, shot_none, "T-NONE", "Comp")
    t_general = _task(project, None, "T-GEN", "Comp")

    v_a_comp = _version(project, t_a_comp, "V-A-COMP")
    v_a_anim = _version(project, t_a_anim, "V-A-ANIM")
    v_b = _version(project, t_b_comp, "V-B")

    review_a = Review.objects.create(project=project, title="Review A")
    review_b = Review.objects.create(project=project, title="Review B")
    ReviewItem.objects.create(review=review_a, version=v_a_comp)
    ReviewItem.objects.create(review=review_b, version=v_b)

    m_a = Media.objects.create(
        project=project, code="MA", entity_type="Version", entity_id=str(v_a_comp.pk)
    )
    m_b = Media.objects.create(
        project=project, code="MB", entity_type="Version", entity_id=str(v_b.pk)
    )
    m_project = Media.objects.create(
        project=project, code="MP", entity_type="Project", entity_id=str(project.pk)
    )

    tl_a = TimelogFactory(task=t_a_comp)
    tl_b = TimelogFactory(task=t_b_comp)

    return {
        "project": project,
        "show_a": show_a,
        "show_b": show_b,
        "shots": (shot_a1, shot_a2, shot_b, shot_none),
        "assets": (asset_a, asset_b),
        "sequences": (sequence_a, sequence_b),
        "episodes": (episode_a, episode_none),
        "tasks": (t_a_comp, t_a_anim, t_b_comp, t_none, t_general),
        "versions": (v_a_comp, v_a_anim, v_b),
        "reviews": (review_a, review_b),
        "media": (m_a, m_b, m_project),
        "timelogs": (tl_a, tl_b),
        "full": _member(project),
        "in_show_a": _member(project, show=show_a),
        "in_comp": _member(project, department="Comp"),
        "in_show_a_comp": _member(project, show=show_a, department="Comp"),
        "in_anim_by_id": _member(project, department_id="d-anim"),
    }


def ids(*rows):
    return {str(row.pk) for row in rows}


class TestFullMembershipIsUnchanged:
    def test_it_sees_the_whole_project(self, world):
        client = _client(world["full"])

        assert _ids(client, "/api/v1/shots/") == ids(*world["shots"])
        assert _ids(client, "/api/v1/assets/") == ids(*world["assets"])
        assert _ids(client, "/api/v1/tasks/") == ids(*world["tasks"])
        assert _ids(client, "/api/v1/versions/") == ids(*world["versions"])
        assert _ids(client, "/api/v1/reviews/") == ids(*world["reviews"])
        assert _ids(client, "/api/v1/media/") == ids(*world["media"])


class TestShowBoundMember:
    def test_it_sees_only_records_assigned_to_its_show(self, world):
        client = _client(world["in_show_a"])
        a1, a2, _b, _none = world["shots"]
        t_a_comp, t_a_anim, *_ = world["tasks"]
        v_a_comp, v_a_anim, _v_b = world["versions"]

        assert _ids(client, "/api/v1/shots/") == ids(a1, a2)
        assert _ids(client, "/api/v1/assets/") == ids(world["assets"][0])
        assert _ids(client, "/api/v1/sequences/") == ids(world["sequences"][0])
        assert _ids(client, "/api/v1/episodes/") == ids(world["episodes"][0])
        assert _ids(client, "/api/v1/tasks/") == ids(t_a_comp, t_a_anim)
        assert _ids(client, "/api/v1/versions/") == ids(v_a_comp, v_a_anim)
        assert _ids(client, "/api/v1/reviews/") == ids(world["reviews"][0])

    def test_unassigned_records_are_hidden(self, world):
        client = _client(world["in_show_a"])
        shot_none = world["shots"][3]
        episode_none = world["episodes"][1]

        assert str(shot_none.pk) not in _ids(client, "/api/v1/shots/")
        assert str(episode_none.pk) not in _ids(client, "/api/v1/episodes/")

    def test_general_tasks_and_other_shows_tasks_are_hidden(self, world):
        client = _client(world["in_show_a"])
        _a, _b, t_b_comp, t_none, t_general = world["tasks"]

        visible = _ids(client, "/api/v1/tasks/")
        assert not visible & ids(t_b_comp, t_none, t_general)

    def test_media_of_other_shows_is_hidden_but_project_media_is_not(self, world):
        client = _client(world["in_show_a"])
        m_a, m_b, m_project = world["media"]

        assert _ids(client, "/api/v1/media/") == ids(m_a, m_project)

    def test_the_show_list_is_unchanged(self, world):
        assert _ids(_client(world["in_show_a"]), "/api/v1/shows/") == ids(world["show_a"])

    def test_timelogs_follow_the_tasks(self, world):
        tl_a, tl_b = world["timelogs"]
        client = _client(world["in_show_a"])

        visible = _ids(client, "/api/v1/timelogs/")
        assert str(tl_a.pk) in visible
        assert str(tl_b.pk) not in visible


class TestDepartmentMember:
    def test_it_sees_its_departments_tasks_and_what_they_reach(self, world):
        client = _client(world["in_comp"])
        a1, a2, shot_b, shot_none = world["shots"]
        t_a_comp, _t_a_anim, t_b_comp, t_none, t_general = world["tasks"]
        v_a_comp, v_a_anim, v_b = world["versions"]
        m_a, m_b, m_project = world["media"]

        assert _ids(client, "/api/v1/tasks/") == ids(t_a_comp, t_b_comp, t_none, t_general)
        assert _ids(client, "/api/v1/shots/") == ids(a1, shot_b, shot_none)
        assert _ids(client, "/api/v1/versions/") == ids(v_a_comp, v_b)
        assert _ids(client, "/api/v1/reviews/") == ids(*world["reviews"])
        assert _ids(client, "/api/v1/media/") == ids(m_a, m_b, m_project)
        assert str(a2.pk) not in _ids(client, "/api/v1/shots/")
        assert str(v_a_anim.pk) not in _ids(client, "/api/v1/versions/")

    def test_a_department_can_be_named_by_id(self, world):
        client = _client(world["in_anim_by_id"])
        t_a_anim = world["tasks"][1]

        assert _ids(client, "/api/v1/tasks/") == ids(t_a_anim)
        assert _ids(client, "/api/v1/shots/") == ids(world["shots"][1])

    def test_the_department_name_is_case_insensitive(self, world):
        ProjectMembership.objects.filter(user=world["in_comp"]).update(department="comp")

        assert len(_ids(_client(world["in_comp"]), "/api/v1/tasks/")) == 4


class TestShowAndDepartmentTogether:
    def test_both_conditions_must_hold(self, world):
        client = _client(world["in_show_a_comp"])
        t_a_comp = world["tasks"][0]

        assert _ids(client, "/api/v1/tasks/") == ids(t_a_comp)
        assert _ids(client, "/api/v1/shots/") == ids(world["shots"][0])
        assert _ids(client, "/api/v1/versions/") == ids(world["versions"][0])
        assert _ids(client, "/api/v1/reviews/") == ids(world["reviews"][0])


class TestWholeProjectViews:
    def test_a_narrowed_member_is_not_given_project_wide_records(self, world):
        project = world["project"]

        for key in ("in_show_a", "in_comp", "in_show_a_comp", "in_anim_by_id"):
            request = type("R", (), {"user": world[key]})()
            assert ProductionBaseSelector.visible_project_ids(request) == []
            assert not ProductionBaseSelector.user_has_full_project_access(
                request=request, project=project
            )

    def test_a_full_member_keeps_them(self, world):
        request = type("R", (), {"user": world["full"]})()

        assert ProductionBaseSelector.visible_project_ids(request) == [world["project"].pk]
        assert ProductionBaseSelector.user_has_full_project_access(
            request=request, project=world["project"]
        )

    def test_narrowed_members_still_have_access_to_the_project_for_writes(self, world):
        request = type("R", (), {"user": world["in_show_a"]})()

        assert ProductionBaseSelector.user_has_project_access(
            request=request, project=world["project"]
        )


class TestAnotherProjectIsUnaffected:
    def test_a_member_narrowed_on_one_project_is_full_on_another(self, world):
        other = ProjectFactory()
        shot = ShotFactory(project=other)
        ProjectMembership.objects.create(
            user=world["in_show_a"], project=other, status="active", role="Artist"
        )

        assert str(shot.pk) in _ids(_client(world["in_show_a"]), "/api/v1/shots/")


class TestCreatingIntoYourShow:
    def test_the_default_show_is_the_callers(self, world):
        request = type("R", (), {"user": world["in_show_a"]})()

        assert (
            ProductionBaseSelector.default_show_id(request, world["project"]) == world["show_a"].pk
        )

    def test_a_full_member_has_no_default(self, world):
        request = type("R", (), {"user": world["full"]})()

        assert ProductionBaseSelector.default_show_id(request, world["project"]) is None

    def test_a_shot_created_through_the_api_lands_in_the_callers_show(self, world):
        client = _client(world["in_show_a"])

        response = client.post(
            "/api/v1/shots/",
            {"project_id": str(world["project"].pk), "code": "NEW010", "name": "New"},
            format="json",
        )

        assert response.status_code == 201, response.content
        assert Shot.objects.get(code="NEW010").show_id == world["show_a"].pk
        assert str(Shot.objects.get(code="NEW010").pk) in _ids(client, "/api/v1/shots/")


class TestAssignShowsCommand:
    def _run(self, world, *args):
        out = StringIO()
        call_command(
            "assign_shows",
            "--project",
            world["project"].code,
            "--show",
            world["show_b"].code,
            *args,
            stdout=out,
        )
        return out.getvalue()

    def test_dry_run_changes_nothing(self, world):
        output = self._run(world, "--dry-run")

        assert "Would assign 1 shots" in output
        assert Shot.objects.get(pk=world["shots"][3].pk).show_id is None

    def test_it_assigns_only_unassigned_records_by_default(self, world):
        self._run(world)

        assert Shot.objects.get(pk=world["shots"][3].pk).show_id == world["show_b"].pk
        assert Shot.objects.get(pk=world["shots"][0].pk).show_id == world["show_a"].pk
        assert Episode.objects.get(pk=world["episodes"][1].pk).show_id == world["show_b"].pk

    def test_reassign_moves_the_rest(self, world):
        self._run(world, "--reassign", "--models", "shots")

        assert not Shot.objects.exclude(show=world["show_b"]).exists()
        assert Asset.objects.get(pk=world["assets"][0].pk).show_id == world["show_a"].pk
        assert Sequence.objects.filter(show=world["show_a"]).exists()

    def test_unknown_project_or_show_is_an_error(self, world):
        from django.core.management.base import CommandError

        with pytest.raises(CommandError):
            call_command("assign_shows", "--project", "NOPE", "--show", "X", stdout=StringIO())
        with pytest.raises(CommandError):
            call_command(
                "assign_shows",
                "--project",
                world["project"].code,
                "--show",
                "NOPE",
                stdout=StringIO(),
            )
