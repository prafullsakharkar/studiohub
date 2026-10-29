"""
Production's ``/organizations/projects/{id}/schedule`` route shows the project's real milestones
(API-SCH-11), read through the ``scheduling.project_milestones`` provider; with no milestones it
returns an empty list instead of the five phases it used to invent.
"""

from __future__ import annotations

from datetime import date

import pytest
from django.utils import timezone

from apps.core import providers
from apps.production.tests.factories import ProjectFactory
from apps.scheduling.models import Milestone
from apps.scheduling.providers import PROJECT_MILESTONES
from apps.scheduling.tests.helpers import VIEW, client_for, person

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return ProjectFactory.create(
        code="SCH", start_date=date(2026, 1, 5), delivery_date=date(2026, 9, 30)
    )


@pytest.fixture
def api(project):
    return client_for(person(VIEW, project=project))


def _url(project):
    return f"/api/organizations/projects/{project.pk}/schedule"


def _milestone(project, name, due, **fields):
    return Milestone.objects.create(project=project, name=name, due_date=due, **fields)


def test_the_projects_milestones_are_returned_in_order_with_the_old_keys(api, project):
    late = _milestone(project, "Final delivery", date(2026, 9, 30), order=2)
    early = _milestone(
        project,
        "Turnover",
        date(2026, 2, 1),
        order=1,
        status="Completed",
        completed_at=timezone.now(),
    )

    response = api.get(_url(project))

    body = response.json()
    assert response.status_code == 200
    assert set(body) == {"project_id", "start_date", "delivery_date", "milestones"}
    assert body["project_id"] == str(project.pk)
    assert body["start_date"] == "2026-01-05" and body["delivery_date"] == "2026-09-30"
    assert body["milestones"] == [
        {"id": str(early.pk), "name": "Turnover", "date": "2026-02-01", "status": "Completed"},
        {"id": str(late.pk), "name": "Final delivery", "date": "2026-09-30", "status": "Pending"},
    ]


def test_equal_order_falls_back_to_the_date_then_the_name(api, project):
    _milestone(project, "B", date(2026, 3, 1))
    _milestone(project, "A", date(2026, 3, 1))
    _milestone(project, "Z", date(2026, 2, 1))

    names = [m["name"] for m in api.get(_url(project)).json()["milestones"]]

    assert names == ["Z", "A", "B"]


def test_a_project_with_no_milestones_has_an_empty_list_not_invented_phases(api, project):
    body = api.get(_url(project)).json()

    assert body["milestones"] == []


def test_deleted_milestones_and_other_projects_are_not_shown(api, project):
    _milestone(project, "Gone", date(2026, 3, 1)).soft_delete()
    _milestone(ProjectFactory.create(code="OTH"), "Theirs", date(2026, 3, 1))

    assert api.get(_url(project)).json()["milestones"] == []


def test_the_route_still_needs_membership_and_the_view_code(project):
    stranger = client_for(person(VIEW))
    no_code = client_for(person(project=project))

    assert stranger.get(_url(project)).status_code == 404
    assert no_code.get(_url(project)).status_code == 403


def test_without_the_provider_the_list_is_empty_not_an_error(api, project):
    _milestone(project, "Turnover", date(2026, 2, 1))
    provider = providers.get(PROJECT_MILESTONES)
    providers.unregister(PROJECT_MILESTONES)
    try:
        response = api.get(_url(project))
    finally:
        providers.register(PROJECT_MILESTONES, provider)

    assert response.status_code == 200 and response.json()["milestones"] == []


def test_the_provider_is_registered_when_the_app_loads():
    assert providers.get(PROJECT_MILESTONES) is not None
