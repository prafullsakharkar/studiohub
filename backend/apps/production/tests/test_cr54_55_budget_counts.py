"""
CR-54 and CR-55, against the real seeded roles (``init_platform``).

CR-54: the project's ``statistics`` and ``summary`` count its deliveries only for a caller with
``delivery.view``, as the dashboard does since CR-53 (a lead holds it, an artist does not).

CR-55: the project's ``budget_usd`` is read and written only with ``project.view_budget``, held by
production-admin and org-admin. Without it the field is left out of every project response (list,
detail, summary, dashboard, and the answer to a write), and a write that names it is refused.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.deliveries.tests.helpers import make_package
from apps.identity.models import Role, UserRole
from apps.identity.tests.factories import UserFactory
from apps.production.models import Project, ProjectMembership
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

BUDGET = Decimal("4800000.00")
HOLDERS = ("production-admin", "org-admin")
NON_HOLDERS = ("vfx-supervisor", "lead-artist", "artist")


@pytest.fixture(autouse=True)
def seeded(seeded_platform_module):
    """The real role matrix from ``init_platform`` (conftest.py)."""


@pytest.fixture
def project():
    project = ProjectFactory.create(code="CR55", budget_usd=BUDGET)
    make_package(project, name="Turnover 1")
    make_package(project, name="Turnover 2")
    return project


def member(project, role_code: str | None, **user_kwargs) -> APIClient:
    user = UserFactory.create(**user_kwargs)
    if role_code:
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def ok(response, status: int = 200):
    assert response.status_code == status, response.content
    return response.json()


# -- CR-54: the delivery count ------------------------------------------------------------------

COUNT_ROUTES = {
    "statistics": ("/api/v1/projects/{id}/statistics/", lambda body: body),
    "summary": ("/api/organizations/projects/{id}/summary/", lambda body: body["counts"]),
}


@pytest.mark.parametrize("route", sorted(COUNT_ROUTES))
class TestTheCountsFollowDeliveryView:
    def counts(self, api, project, route):
        path, pick = COUNT_ROUTES[route]
        return pick(ok(api.get(path.format(id=project.pk))))

    def test_an_artist_counts_no_deliveries(self, project, route):
        assert self.counts(member(project, "artist"), project, route)["deliveries"] == 0

    def test_a_lead_counts_them(self, project, route):
        assert self.counts(member(project, "lead-artist"), project, route)["deliveries"] == 2

    def test_every_other_count_is_the_same_for_both(self, project, route):
        artist = self.counts(member(project, "artist"), project, route)
        lead = self.counts(member(project, "lead-artist"), project, route)

        assert artist.pop("deliveries") != lead.pop("deliveries")
        assert artist == lead
        assert set(artist) >= {"shots", "tasks", "assets", "versions", "reviews", "notes"}


# -- CR-55: reading the budget ------------------------------------------------------------------


def budget_reads(api, project) -> dict[str, object]:
    """``budget_usd`` as each read route gives it, or the string "absent"."""
    rows = ok(api.get("/api/v1/projects/"))["results"]
    (row,) = [r for r in rows if r["code"] == "CR55"]
    detail = ok(api.get(f"/api/v1/projects/{project.pk}/"))
    summary = ok(api.get(f"/api/organizations/projects/{project.pk}/summary/"))["project"]
    primary = ok(api.get(f"/api/v1/projects/{project.pk}/dashboard/"))["project"]
    fallback = ok(api.get(f"/api/organizations/projects/{project.pk}/dashboard"))["project"]
    found = {
        "list": row,
        "detail": detail,
        "summary": summary,
        "dashboard": primary,
        "dashboard_fallback": fallback,
    }
    return {name: body.get("budget_usd", "absent") for name, body in found.items()}


@pytest.mark.parametrize("role", NON_HOLDERS)
def test_without_the_code_no_route_returns_the_budget(project, role):
    assert set(budget_reads(member(project, role), project).values()) == {"absent"}


@pytest.mark.parametrize("role", HOLDERS)
def test_the_producer_and_the_studio_admin_read_it_everywhere(project, role):
    assert budget_reads(member(project, role), project) == {
        "list": "4800000.00",
        "detail": "4800000.00",
        "summary": "4800000.00",
        "dashboard": 4800000.0,
        "dashboard_fallback": 4800000.0,
    }


def test_a_superuser_reads_it(project):
    api = member(project, None, is_superuser=True, is_staff=True)

    assert budget_reads(api, project)["detail"] == "4800000.00"


def test_the_rest_of_the_project_record_is_the_same_with_or_without_the_code(project):
    supervisor = ok(member(project, "vfx-supervisor").get(f"/api/v1/projects/{project.pk}/"))
    producer = ok(member(project, "production-admin").get(f"/api/v1/projects/{project.pk}/"))

    assert producer.pop("budget_usd") == "4800000.00"
    assert supervisor == producer


# -- CR-55: writing the budget ------------------------------------------------------------------


class TestWritingTheBudget:
    def test_a_supervisor_cannot_change_it_and_nothing_is_saved(self, project):
        api = member(project, "vfx-supervisor")
        name = project.name

        response = api.patch(
            f"/api/v1/projects/{project.pk}/",
            {"budget_usd": "1.00", "name": "Renamed"},
            format="json",
        )

        assert response.status_code == 403, response.content
        assert "project.view_budget" in str(response.json())
        project.refresh_from_db()
        assert (project.budget_usd, project.name) == (BUDGET, name)

    def test_naming_the_stored_value_is_refused_too(self, project):
        """The answer must not depend on the budget, or it would tell its value."""
        api = member(project, "vfx-supervisor")

        response = api.patch(
            f"/api/v1/projects/{project.pk}/", {"budget_usd": str(BUDGET)}, format="json"
        )

        assert response.status_code == 403

    def test_a_supervisor_still_edits_the_rest_and_the_answer_hides_the_budget(self, project):
        api = member(project, "vfx-supervisor")

        body = ok(api.patch(f"/api/v1/projects/{project.pk}/", {"name": "Renamed"}, format="json"))

        assert "budget_usd" not in body
        project.refresh_from_db()
        assert (project.name, project.budget_usd) == ("Renamed", BUDGET)

    def test_a_supervisor_cannot_create_a_project_with_a_budget(self, project):
        api = member(project, "vfx-supervisor")

        response = api.post(
            "/api/v1/projects/",
            {"code": "CR55B", "name": "With budget", "budget_usd": "10.00"},
            format="json",
        )

        assert response.status_code == 403, response.content
        assert not Project.all_objects.filter(code="CR55B").exists()

    def test_a_supervisor_creates_one_without_and_the_answer_hides_the_budget(self, project):
        api = member(project, "vfx-supervisor")

        body = ok(
            api.post("/api/v1/projects/", {"code": "CR55C", "name": "No budget"}, format="json"),
            201,
        )

        assert "budget_usd" not in body
        assert Project.objects.filter(code="CR55C").exists()

    def test_the_producer_sets_it_on_update_and_on_create(self, project):
        api = member(project, "production-admin")

        updated = ok(
            api.patch(f"/api/v1/projects/{project.pk}/", {"budget_usd": "5.00"}, format="json")
        )
        created = ok(
            api.post(
                "/api/v1/projects/",
                {"code": "CR55D", "name": "Producer's", "budget_usd": "7.00"},
                format="json",
            ),
            201,
        )

        assert (updated["budget_usd"], created["budget_usd"]) == ("5.00", "7.00")
        project.refresh_from_db()
        assert project.budget_usd == Decimal("5.00")
        assert Project.objects.get(code="CR55D").budget_usd == Decimal("7.00")
