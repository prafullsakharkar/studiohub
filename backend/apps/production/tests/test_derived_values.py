"""
A task's hours come from its timelogs (D-15) and a shot's current version from its versions
(D-16). Both are derived on every read; the old stored columns are not consulted.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, Task, Timelog, Version
from apps.production.selectors.rollups import ShotCurrentVersionSelector, TaskHoursSelector
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

CODES = (
    "task.view",
    "task.create",
    "task.update",
    "shot.view",
    "shot.create",
    "shot.update",
    "version.view",
    "project.view",
)


@pytest.fixture
def project():
    return ProjectFactory.create(code="DRV1")


@pytest.fixture
def client(project):
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _log(task, hours, status="Approved", **extra):
    return TimelogFactory.create(
        task=task, duration_hours=Decimal(str(hours)), status=status, **extra
    )


class TestTaskHours:
    def test_logged_is_approved_only_and_pending_is_submitted_only(self, project):
        task = TaskFactory.create(project=project, code="T1")
        _log(task, 4)
        _log(task, "2.5")
        _log(task, 3, status="Submitted")
        _log(task, 1, status="Draft")
        _log(task, 8, status="Rejected")
        _log(task, 5, is_deleted=True)

        assert TaskHoursSelector.of(task) == (Decimal("6.50"), Decimal("3.00"))

    def test_an_approved_correction_reduces_the_total(self, project):
        task = TaskFactory.create(project=project, code="T1")
        original = _log(task, 8)
        _log(task, -2, adjustment_of=original)

        assert TaskHoursSelector.of(task)[0] == Decimal("6.00")

    def test_a_task_without_timelogs_has_zero(self, project):
        assert (
            TaskHoursSelector.of(TaskFactory.create(project=project, code="T1"))
            == (Decimal("0.00"),) * 2
        )

    def test_responses_show_both_values_and_ignore_the_stored_column(self, client, project):
        task = TaskFactory.create(project=project, code="T1")
        Task.objects.filter(pk=task.pk).update(
            logged_hours=Decimal("40")
        )  # an old hand-typed value
        _log(task, 6)
        _log(task, 2, status="Submitted")

        detail = client.get(f"/api/v1/tasks/{task.id}/").json()
        listed = client.get("/api/v1/tasks/").json()["results"][0]

        for row in (detail, listed):
            assert (row["logged_hours"], row["pending_hours"]) == ("6.00", "2.00")

    def test_approving_a_timelog_moves_hours_from_pending_to_logged(self, client, project):
        task = TaskFactory.create(project=project, code="T1")
        log = _log(task, 2, status="Submitted")
        assert client.get(f"/api/v1/tasks/{task.id}/").json()["pending_hours"] == "2.00"

        Timelog.objects.filter(pk=log.pk).update(status="Approved")

        row = client.get(f"/api/v1/tasks/{task.id}/").json()
        assert (row["logged_hours"], row["pending_hours"]) == ("2.00", "0.00")

    def test_the_list_does_not_query_per_task(self, client, project, django_assert_max_num_queries):
        for index in range(6):
            _log(TaskFactory.create(project=project, code=f"T{index}"), 1)

        with django_assert_max_num_queries(25):
            assert client.get("/api/v1/tasks/").status_code == 200

    def test_sending_hours_is_still_a_400_unless_it_is_the_derived_value(self, client, project):
        task = TaskFactory.create(project=project, code="T1")
        _log(task, 6)

        changed = client.patch(
            f"/api/v1/tasks/{task.id}/", {"logged_hours": "40.00"}, format="json"
        )
        echoed = client.patch(
            f"/api/v1/tasks/{task.id}/", {"logged_hours": "6.00", "title": "kept"}, format="json"
        )
        created = client.post(
            "/api/v1/tasks/",
            {
                "project_id": str(project.id),
                "title": "x",
                "code": "T2",
                "entity_type": "Shot",
                "logged_hours": "9",
            },
            format="json",
        )

        assert changed.status_code == 400 and "logged_hours" in changed.json()
        assert echoed.status_code == 200, echoed.json()
        assert echoed.json()["logged_hours"] == "6.00"
        assert created.status_code == 400

    def test_write_responses_carry_the_derived_values(self, client, project):
        resp = client.post(
            "/api/v1/tasks/",
            {"project_id": str(project.id), "title": "x", "code": "T3", "entity_type": "Shot"},
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert (resp.json()["logged_hours"], resp.json()["pending_hours"]) == ("0.00", "0.00")

    def test_the_resources_view_adds_up_approved_hours(self, client, project):
        user = UserFactory.create()
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
        a = TaskFactory.create(project=project, code="TA", assignee=user)
        b = TaskFactory.create(project=project, code="TB", assignee=user)
        _log(a, 3)
        _log(b, 4)
        _log(b, 9, status="Submitted")

        rows = client.get(f"/api/organizations/projects/{project.id}/resources").json()["artists"]

        assert [r["hours_logged"] for r in rows] == [7.0]


class TestShotCurrentVersion:
    def _version(self, shot, number, *, published=False, **extra):
        return VersionFactory.create(
            project=shot.project, shot=shot, code=f"{shot.code}-{number}", version_number=number,
            is_published=published, **extra,
        )  # fmt: skip

    def test_none_means_empty(self, project):
        shot = ShotFactory.create(project=project, code="S1")

        assert ShotCurrentVersionSelector.of(shot) == ("", None)

    def test_without_a_published_version_the_latest_one_wins(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        self._version(shot, "v001")
        latest = self._version(shot, "v002")

        assert ShotCurrentVersionSelector.of(shot) == ("v002", latest.id)

    def test_a_published_version_wins_even_if_an_unpublished_one_is_newer(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        first = self._version(shot, "v001", published=True)
        self._version(shot, "v002")
        second_published = self._version(shot, "v003", published=True)
        self._version(shot, "v004")

        assert ShotCurrentVersionSelector.of(shot) == ("v003", second_published.id)

        Version.objects.filter(pk=second_published.pk).update(is_published=False)
        assert ShotCurrentVersionSelector.of(shot) == ("v001", first.id)  # unpublishing falls back

    def test_archived_deleted_and_other_shots_versions_do_not_count(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        other = ShotFactory.create(project=project, code="S2")
        kept = self._version(shot, "v001")
        self._version(shot, "v002", is_archived=True)
        self._version(shot, "v003", is_deleted=True)
        self._version(other, "v009")

        assert ShotCurrentVersionSelector.of(shot) == ("v001", kept.id)

    def test_responses_and_the_list_carry_it_and_ignore_the_stored_column(self, client, project):
        shot = ShotFactory.create(project=project, code="S1", current_version="v777")
        version = self._version(shot, "v002", published=True)
        ShotFactory.create(project=project, code="S2")

        detail = client.get(f"/api/v1/shots/{shot.id}/").json()
        listed = {row["code"]: row for row in client.get("/api/v1/shots/").json()["results"]}

        assert (detail["current_version"], detail["current_version_id"]) == (
            "v002",
            str(version.id),
        )
        assert listed["S1"]["current_version"] == "v002"
        assert (listed["S2"]["current_version"], listed["S2"]["current_version_id"]) == ("", None)

    def test_the_list_does_not_query_per_shot(self, client, project, django_assert_max_num_queries):
        for index in range(6):
            self._version(ShotFactory.create(project=project, code=f"S{index}"), "v001")

        with django_assert_max_num_queries(25):
            assert client.get("/api/v1/shots/").status_code == 200

    def test_sending_it_is_a_400_unless_it_is_what_the_server_would_say(self, client, project):
        shot = ShotFactory.create(project=project, code="S1")
        self._version(shot, "v002")

        changed = client.patch(
            f"/api/v1/shots/{shot.id}/", {"current_version": "v009"}, format="json"
        )
        echoed = client.patch(
            f"/api/v1/shots/{shot.id}/", {"current_version": "v002", "name": "kept"}, format="json"
        )
        new_default = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S2", "current_version": "v001"},
            format="json",
        )
        new_other = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S3", "current_version": "v005"},
            format="json",
        )

        assert changed.status_code == 400 and "current_version" in changed.json()
        assert echoed.status_code == 200, echoed.json()
        assert new_default.status_code == 201, new_default.json()
        assert new_default.json()["current_version"] == ""
        assert new_other.status_code == 400

    def test_the_project_dashboard_shows_it(self, client, project):
        shot = ShotFactory.create(project=project, code="S1", current_version="v777")
        self._version(shot, "v004", published=True)

        data = client.get(f"/api/v1/projects/{project.id}/dashboard/").json()

        assert data["shots"]["recent_shots"][0]["current_version"] == "v004"
