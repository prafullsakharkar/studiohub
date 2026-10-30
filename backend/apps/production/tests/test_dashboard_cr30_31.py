"""CR-30 and CR-31: the dashboard shows the project's real milestones, and its flags and counts follow one set of rules."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.deliveries.models import DeliveryPackage
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, TaskFactory
from apps.scheduling.models import Milestone

pytestmark = pytest.mark.django_db


def dashboard(client, project):
    response = client.get(f"/api/v1/projects/{project.id}/dashboard/")
    assert response.status_code == 200, response.content
    return response.json()


@pytest.fixture
def project(staff_user):
    project = ProjectFactory.create(code="CR3031")
    ProjectMembership.objects.get_or_create(
        user=staff_user, project=project, defaults={"status": "active", "role": "Artist"}
    )
    return project


def milestone(project, name, due, status="Pending", **extra):
    if status == "Completed":
        extra["completed_at"] = timezone.now()
    return Milestone.objects.create(
        project=project, name=name, due_date=due, status=status, kind="general", **extra
    )


class TestMilestones:
    def test_the_dashboard_lists_the_projects_own_milestones(self, staff_client, project):
        today = timezone.localdate()
        past = milestone(project, "Turnover", today - timedelta(days=5), "Completed")
        late = milestone(project, "Previs lock", today - timedelta(days=1), "In Progress")
        going = milestone(project, "Layout", today + timedelta(days=3), "In Progress")
        later = milestone(project, "Final", today + timedelta(days=30))
        rows = {
            row["name"]: row for row in dashboard(staff_client, project)["schedule"]["milestones"]
        }
        assert set(rows) == {"Turnover", "Previs lock", "Layout", "Final"}
        assert rows["Turnover"] == {
            "id": str(past.pk),
            "name": "Turnover",
            "date": past.due_date.isoformat(),
            "status": "completed",
        }
        assert rows["Previs lock"]["status"] == "overdue" and rows["Previs lock"]["id"] == str(
            late.pk
        )
        assert rows["Layout"]["status"] == "in_progress" and rows["Layout"]["id"] == str(going.pk)
        assert rows["Final"]["status"] == "upcoming" and rows["Final"]["id"] == str(later.pk)

    def test_a_project_without_milestones_has_none_and_other_projects_are_not_mixed_in(
        self, staff_client, project, staff_user
    ):
        other = ProjectFactory.create(code="CR3032")
        milestone(other, "Not mine", timezone.localdate())
        assert dashboard(staff_client, project)["schedule"]["milestones"] == []

    def test_nothing_is_invented_from_progress(self, staff_client, project):
        names = {row["name"] for row in dashboard(staff_client, project)["schedule"]["milestones"]}
        assert not names & {"Plate Turnover & Ingest", "Final 4K ACES Master Delivery"}


class TestOverdueFlagFollowsTheCount:
    def test_an_approved_task_past_its_date_is_not_overdue(self, staff_client, project):
        today = timezone.localdate()
        TaskFactory.create(
            project=project, code="AP1", status="Approved", due_date=today - timedelta(days=3)
        )
        TaskFactory.create(
            project=project, code="DN1", status="Done", due_date=today - timedelta(days=3)
        )
        TaskFactory.create(
            project=project, code="CP1", status="Completed", due_date=today - timedelta(days=3)
        )
        TaskFactory.create(
            project=project, code="LT1", status="In Progress", due_date=today - timedelta(days=1)
        )
        data = dashboard(staff_client, project)
        flags = {task["code"]: task["is_overdue"] for task in data["tasks"]["recent_tasks"]}
        assert flags == {"AP1": False, "DN1": False, "CP1": False, "LT1": True}
        assert data["tasks"]["overdue"] == sum(flags.values()) == 1
        assert data["summary"]["overdue_tasks"] == 1


def package(project, code, status, due):
    return DeliveryPackage.objects.create(
        project=project, name=code, code=code, status=status, expires_at=due
    )


class TestDeliveryCounts:
    def test_cancelled_is_neither_late_nor_upcoming_and_finished_words_are_delivered(
        self, staff_client, project
    ):
        now = timezone.now()
        past, ahead = now - timedelta(days=2), now + timedelta(days=5)
        package(project, "D-DRAFT-LATE", "Draft", past)
        package(project, "D-DRAFT-AHEAD", "Draft", ahead)
        package(project, "D-CANCELLED", "Cancelled", past)
        package(project, "D-COMPLETE", "Complete", past)
        package(project, "D-COMPLETED", "Completed", past)
        package(project, "D-SIGNED", "Signed Off", past)
        package(project, "D-SUBMITTED", "Submitted", ahead)
        data = dashboard(staff_client, project)
        deliveries = data["deliveries"]
        assert deliveries["total"] == 7
        assert deliveries["late"] == 1  # only the Draft past its date
        assert deliveries["delivered"] == 3  # Complete, Completed, Signed Off
        assert deliveries["upcoming"] == 2  # the Draft ahead and the Submitted one
        assert (
            deliveries["delivered"] + deliveries["late"] + deliveries["upcoming"] + 1
            == deliveries["total"]
        )  # + the cancelled
        summary = data["summary"]
        assert (
            summary["late_deliveries"],
            summary["delivered_deliveries"],
            summary["upcoming_deliveries"],
        ) == (1, 3, 2)
        assert data["schedule"]["is_delayed"] is True  # a late delivery

    def test_a_cancelled_delivery_past_its_date_does_not_delay_the_schedule(
        self, staff_client, project
    ):
        package(project, "D-GONE", "Cancelled", timezone.now() - timedelta(days=9))
        data = dashboard(staff_client, project)
        assert data["deliveries"]["late"] == 0 and data["deliveries"]["upcoming"] == 0
        assert data["schedule"]["is_delayed"] is False

    def test_a_delivered_one_is_delivered_even_past_its_date(self, staff_client, project):
        package(project, "D-OLD", "Complete", timezone.now() - timedelta(days=30))
        assert dashboard(staff_client, project)["deliveries"]["delivered"] == 1
