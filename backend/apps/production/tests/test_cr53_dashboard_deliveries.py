"""
CR-53: the project dashboard shows deliveries only to who may read them.

The delivery cards name the client (``recipient``), so the dashboard asks for the code of the nested
deliveries route (``delivery.view``), not only ``project.view``. Without it every delivery figure is
empty and keeps its shape. Real seeded roles: a lead holds ``delivery.view``, an artist does not.
"""

from __future__ import annotations

import json
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import ChangeLog
from apps.deliveries.tests.helpers import make_package
from apps.identity.models import Role, UserRole
from apps.identity.tests.factories import UserFactory
from apps.masterdata.tests.factories import ClientFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

TURNOVER = "Episode 1 turnover"
CLIENT = "Acme Pictures"


@pytest.fixture(autouse=True)
def seeded(seeded_platform_module):
    """The real role matrix from ``init_platform`` (conftest.py)."""


@pytest.fixture
def project():
    acme = ClientFactory.create(code="ACME53", name=CLIENT)
    project = ProjectFactory.create(code="CR53", client_id=str(acme.pk), client_name=CLIENT)
    package = make_package(
        project, client_id=acme.pk, name=TURNOVER, expires_at=timezone.now() + timedelta(days=7)
    )
    ChangeLog.objects.create(
        change_type="update",
        target_type="DeliveryPackage",
        target_id=str(package.pk),
        target_name=package.code,
        description=f"{TURNOVER} sent to {CLIENT}",
    )
    return project


def member(project, role_code: str) -> APIClient:
    user = UserFactory.create()
    UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


ROUTES = {
    "primary": "/api/v1/projects/{id}/dashboard/",
    "fallback": "/api/organizations/projects/{id}/dashboard",
}


def dashboard(api, project, route):
    response = api.get(ROUTES[route].format(id=project.pk))
    assert response.status_code == 200, response.content
    return response.json()


@pytest.mark.parametrize("route", sorted(ROUTES))
class TestTheDashboardFollowsDeliveryView:
    def test_an_artist_gets_no_delivery_figures(self, project, route):
        body = dashboard(member(project, "artist"), project, route)

        assert body["deliveries"] == {
            "total": 0,
            "upcoming": 0,
            "delivered": 0,
            "late": 0,
            "items": [],
        }
        summary = body["summary"]
        assert [summary[f"{k}_deliveries"] for k in ("total", "upcoming", "delivered", "late")] == [
            0,
            0,
            0,
            0,
        ]
        assert body["schedule"].get("next_deadline", {}).get("type") != "Delivery"
        assert not [row for row in body["activity"] if row["entity_type"] == "DeliveryPackage"]
        # Nothing of the delivery anywhere in the response: its name, its code, its activity line.
        assert TURNOVER not in json.dumps(body)

    def test_a_lead_gets_them(self, project, route):
        body = dashboard(member(project, "lead-artist"), project, route)

        assert body["deliveries"]["total"] == 1 and body["deliveries"]["upcoming"] == 1
        [card] = body["deliveries"]["items"]
        assert (card["title"], card["recipient"]) == (TURNOVER, CLIENT)
        assert body["summary"]["total_deliveries"] == 1
        assert body["schedule"]["next_deadline"]["type"] == "Delivery"
        assert [row for row in body["activity"] if row["entity_type"] == "DeliveryPackage"]

    def test_the_artist_still_sees_whose_project_it_is(self, project, route):
        """The project's own client name is the project's, not the deliveries' (CR-53 item 6)."""
        body = dashboard(member(project, "artist"), project, route)

        assert body["project"]["client_name"] == CLIENT

    def test_the_rest_of_the_dashboard_is_the_same_for_both(self, project, route):
        artist = dashboard(member(project, "artist"), project, route)
        lead = dashboard(member(project, "lead-artist"), project, route)

        for section in ("project", "production", "shots", "tasks", "reviews", "workload"):
            assert artist[section] == lead[section], section
