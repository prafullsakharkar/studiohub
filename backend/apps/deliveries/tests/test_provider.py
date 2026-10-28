"""
Production reads delivery figures through a provider, not by importing Deliveries
(docs/delivery-pipeline/CONTRACTS.md X-01, X-05).
"""

from __future__ import annotations

import ast
from datetime import timedelta
from pathlib import Path

import pytest
from django.utils import timezone

from apps.core import providers
from apps.deliveries.models import DeliveryPackage
from apps.deliveries.providers import PROJECT_FIGURES, ProjectDeliveryFigures
from apps.deliveries.providers import register as register_deliveries
from apps.deliveries.tests.helpers import client_for, make_package, operator, package_with_items
from apps.production.selectors.dashboard import ProjectDashboardSelector
from apps.production.selectors.project import ProjectSelector
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def without_deliveries():
    """The provider unregistered, as if the deliveries app were not installed; restored after."""
    saved = providers.get(PROJECT_FIGURES)
    providers.unregister(PROJECT_FIGURES)
    yield
    providers.register(PROJECT_FIGURES, saved)


class TestRegistry:
    def test_register_get_unregister(self):
        providers.register("test.thing", object)
        assert providers.get("test.thing") is object
        providers.unregister("test.thing")
        assert providers.get("test.thing") is None
        providers.unregister("test.thing")  # harmless

    def test_deliveries_registers_itself_when_the_app_loads(self):
        assert isinstance(providers.get(PROJECT_FIGURES), ProjectDeliveryFigures)

    def test_registering_again_replaces_it(self):
        register_deliveries()
        assert isinstance(providers.get(PROJECT_FIGURES), ProjectDeliveryFigures)


class TestTheProvider:
    def test_counts_and_rows_are_per_project(self):
        project = ProjectFactory.create(code="PRVA")
        make_package(project, code="PRV-1")
        make_package(project, code="PRV-2")
        make_package(code="OTHER-PRV")
        figures = ProjectDeliveryFigures()

        assert figures.count(project) == 2
        assert {row["status"] for row in figures.status_rows(project)} == {"Draft"}
        assert len(figures.entity_ids(project)) == 2

    def test_the_dashboard_cards_keep_their_shape(self):
        project = ProjectFactory.create(code="PRVB")
        package = package_with_items(
            project, code="CARD-1", expires_at=timezone.now() + timedelta(days=3)
        )

        [card] = ProjectDeliveryFigures().recent_items(project)

        assert card == {
            "id": str(package.pk),
            "title": "Turnover",
            "package_name": "CARD-1",
            "status": "Draft",
            "recipient": "",
            "due_date": package.expires_at.date().isoformat(),
            "item_count": 1,
        }

    def test_a_delivery_without_a_due_date_has_an_empty_one(self):
        project = ProjectFactory.create(code="PRVC")
        make_package(project, code="NODUE-1")

        [card] = ProjectDeliveryFigures().recent_items(project)

        assert card["due_date"] == "" and "item_count" not in card

    def test_the_nearest_upcoming_due_date(self):
        project = ProjectFactory.create(code="PRVD")
        soon = timezone.now() + timedelta(days=2)
        make_package(project, code="SOON-1", name="Soon", expires_at=soon)
        make_package(project, code="LATER-1", name="Later", expires_at=soon + timedelta(days=30))
        make_package(
            project, code="PAST-1", name="Past", expires_at=timezone.now() - timedelta(days=5)
        )

        due = ProjectDeliveryFigures().next_due(project, timezone.localdate())

        assert due == {"title": "Soon", "due": soon.date()}

    def test_no_upcoming_due_date_gives_none(self):
        assert (
            ProjectDeliveryFigures().next_due(
                ProjectFactory.create(code="PRVE"), timezone.localdate()
            )
            is None
        )


class TestProductionUsesIt:
    def test_the_summary_and_the_dashboard_count_deliveries(self):
        project = ProjectFactory.create(code="PRVF")
        make_package(project, code="DSH-1")
        DeliveryPackage.objects.filter(project=project).update(status="Complete")
        make_package(project, code="DSH-2")

        assert ProjectSelector.summary_counts(project)["deliveries"] == 2
        deliveries = ProjectDashboardSelector.build(project)["deliveries"]
        assert (deliveries["total"], deliveries["delivered"]) == (2, 1)
        assert len(deliveries["items"]) == 2

    def test_without_the_provider_everything_answers_empty_not_an_error(self, without_deliveries):
        project = ProjectFactory.create(code="PRVG")
        make_package(project, code="HIDDEN-1")

        assert ProjectSelector.summary_counts(project)["deliveries"] == 0
        deliveries = ProjectDashboardSelector.build(project)["deliveries"]
        assert (deliveries["total"], deliveries["items"]) == (0, [])

    def test_the_nested_route_lists_the_projects_deliveries(self):
        project = ProjectFactory.create(code="PRVH")
        user = operator(project, "delivery.view", "project.view")
        make_package(project, code="NEST-1")
        make_package(code="ELSEWHERE-1")

        response = client_for(user).get(f"/api/organizations/projects/{project.pk}/deliveries")

        assert response.status_code == 200, response.content
        assert [row["code"] for row in response.json()["results"]] == ["NEST-1"]

    def test_the_nested_route_without_the_provider_is_an_empty_list(self, without_deliveries):
        project = ProjectFactory.create(code="PRVI")
        user = operator(project, "delivery.view", "project.view")

        response = client_for(user).get(f"/api/organizations/projects/{project.pk}/deliveries")

        assert response.status_code == 200 and response.json() == []


def test_production_no_longer_imports_deliveries_or_publishing():
    """X-01: Production reaches the delivery pipeline apps only through providers. (Scheduling is Phase 9.)"""
    root = Path(__file__).resolve().parents[3] / "production"
    offenders = []
    for path in root.rglob("*.py"):
        relative = path.relative_to(root).as_posix()
        if relative.startswith(("tests/", "migrations/")):
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            names = []
            if isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            elif isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            offenders += [
                f"{relative}:{getattr(node, 'lineno', 0)} {name}"
                for name in names
                if name.startswith(("apps.deliveries", "apps.publishing"))
            ]
    assert offenders == []
