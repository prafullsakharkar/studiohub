"""
Contract tests for the project dashboard endpoints.

Frontend contract (studiohub-react):

* ``GET /api/v1/projects/{id}/dashboard/`` (primary, ``X-Organization-Id``)
* ``GET /api/organizations/{org}/projects/{project}/dashboard`` (fallback)

Both return the ``ProjectDashboardData`` shape; every value is aggregated
from real production records. Also covers the legacy
``GET /api/v1/analytics/kpis/`` ``ProductionKpis`` shape.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from apps.deliveries.models import DeliveryPackage
from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_org_admin
from apps.production.models import Review
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    ShotFactory,
    TaskFactory,
)


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _dashboard_url(project):
    # Exact frontend path (`getDashboardData` primary endpoint).
    return f"/api/v1/projects/{project.id}/dashboard/"


def _nested_url(org, project_ref):
    return f"/api/organizations/{org.id}/projects/{project_ref}/dashboard"


@pytest.mark.django_db
class TestProjectDashboardPrimary:
    def _seed(self):
        org = OrganizationFactory.create()
        today = timezone.localdate()
        project = ProjectFactory.create(
            organization=org,
            code="DASH01",
            start_date=today - timedelta(days=30),
            delivery_date=today + timedelta(days=60),
        )
        ShotFactory.create(organization=org, project=project, code="SH001", status="Approved")
        ShotFactory.create(organization=org, project=project, code="SH002", status="Approved")
        ShotFactory.create(organization=org, project=project, code="SH003", status="In Progress")
        ShotFactory.create(organization=org, project=project, code="SH004", status="Not Started")
        TaskFactory.create(
            organization=org, project=project, code="TSK001",
            status="Approved", due_date=today - timedelta(days=2),
        )
        TaskFactory.create(
            organization=org, project=project, code="TSK002",
            status="In Progress", due_date=today - timedelta(days=1),
        )
        TaskFactory.create(
            organization=org, project=project, code="TSK003",
            status="Not Started", due_date=today + timedelta(days=5),
        )
        TaskFactory.create(
            organization=org, project=project, code="TSK004", status="Not Started",
        )
        AssetFactory.create(organization=org, project=project, code="AST001", status="Approved")
        AssetFactory.create(organization=org, project=project, code="AST002", status="Not Started")
        Review.objects.create(
            organization=org, project=project, title="Dailies", status="Approved"
        )
        Review.objects.create(
            organization=org, project=project, title="Client review",
            status="Pending Review",
        )
        DeliveryPackage.objects.create(
            organization=org, project=project, name="Turnover 1", code="DLV-DASH-01",
            status="Submitted", expires_at=timezone.now() + timedelta(days=10),
        )
        DeliveryPackage.objects.create(
            organization=org, project=project, name="Turnover 0", code="DLV-DASH-00",
            status="Complete", expires_at=timezone.now() - timedelta(days=3),
        )
        return org, project, today

    def test_full_contract_shape_with_real_values(self, staff_client, staff_user):
        org, project, today = self._seed()
        grant_org_admin(staff_user, org)
        resp = staff_client.get(_dashboard_url(project), **_org_header(org))

        assert resp.status_code == status.HTTP_200_OK, resp.data
        data = resp.data
        for section in (
            "project", "summary", "production", "shots", "tasks",
            "reviews", "schedule", "workload", "deliveries", "activity",
        ):
            assert section in data, section

        assert data["project"]["id"] == str(project.id)
        assert data["project"]["organization_id"] == str(org.id)
        assert data["project"]["code"] == "DASH01"
        assert data["project"]["start_date"] == (today - timedelta(days=30)).isoformat()
        assert data["project"]["delivery_date"] == (today + timedelta(days=60)).isoformat()

        summary = data["summary"]
        assert summary["total_shots"] == 4
        assert summary["approved_shots"] == 2
        assert summary["in_progress_shots"] == 1
        assert summary["shots_at_risk"] == 0
        assert summary["shots_completion_pct"] == 50
        assert summary["total_tasks"] == 4
        assert summary["open_tasks"] == 2
        assert summary["in_progress_tasks"] == 1
        assert summary["completed_tasks"] == 1
        # TSK001 is Approved (done) so only TSK002 is overdue.
        assert summary["overdue_tasks"] == 1
        assert summary["tasks_completion_pct"] == 25
        assert summary["total_assets"] == 2
        assert summary["approved_assets"] == 1
        assert summary["in_progress_assets"] == 1
        assert summary["needs_revision_assets"] == 0
        assert summary["total_reviews"] == 2
        assert summary["approved_reviews"] == 1
        assert summary["pending_reviews"] == 1
        assert summary["total_deliveries"] == 2
        assert summary["upcoming_deliveries"] == 1
        assert summary["delivered_deliveries"] == 1
        assert summary["late_deliveries"] == 0

        production = data["production"]
        assert production["overall_progress_pct"] == 40  # 50*.6 + 25*.4
        assert production["completed_shots"] == 2
        assert production["not_started_shots"] == 1
        assert production["methodology_note"].startswith("Weighted aggregate")
        assert sum(item["count"] for item in production["status_breakdown"]) == 4

        assert data["shots"]["total"] == 4
        assert data["shots"]["by_status"]["Approved"] == 2
        assert len(data["shots"]["recent_shots"]) == 4
        assert data["shots"]["recent_shots"][0]["code"]
        assert data["tasks"]["blocked"] == 0
        assert data["tasks"]["review"] == 0
        assert len(data["tasks"]["recent_tasks"]) == 4
        assert len(data["reviews"]["recent_reviews"]) == 2

        schedule = data["schedule"]
        assert schedule["days_total"] == 90
        assert schedule["days_elapsed"] == 30
        assert schedule["days_remaining"] == 60
        assert len(schedule["milestones"]) == 5
        assert schedule["next_deadline"]["type"] == "Task"
        assert schedule["next_deadline"]["date"] == (today + timedelta(days=5)).isoformat()

        assert data["deliveries"]["items"][0]["due_date"]
        assert len(data["activity"]) > 0
        first = data["activity"][0]
        for key in ("id", "entity_type", "entity_id", "action", "user_name", "timestamp", "description"):
            assert key in first, key

    def test_lookup_by_code_and_unknown_404(self, staff_client, staff_user):
        org, project, _ = self._seed()
        grant_org_admin(staff_user, org)
        resp = staff_client.get("/api/v1/projects/dash01/dashboard/", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["project"]["id"] == str(project.id)

        resp = staff_client.get("/api/v1/projects/nope/dashboard/", **_org_header(org))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_organization_scope(self, staff_client):
        org, project, _ = self._seed()
        resp = staff_client.get(_dashboard_url(project))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_cross_organization_isolation(self, staff_client):
        org, project, _ = self._seed()
        other = OrganizationFactory.create()
        resp = staff_client.get(_dashboard_url(project), **_org_header(other))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_empty_project_returns_well_formed_zeros(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, code="EMPTY01")
        resp = staff_client.get(_dashboard_url(project), **_org_header(org))

        assert resp.status_code == status.HTTP_200_OK, resp.data
        summary = resp.data["summary"]
        assert summary["total_shots"] == 0
        assert summary["shots_completion_pct"] == 0
        assert summary["total_tasks"] == 0
        assert resp.data["production"]["overall_progress_pct"] == 0
        assert resp.data["production"]["status_breakdown"]
        assert resp.data["shots"]["recent_shots"] == []
        # The project's own creation is change-tracked, so the feed carries
        # exactly that entry — the audit pipeline working, not mock data.
        assert len(resp.data["activity"]) == 1
        assert resp.data["activity"][0]["entity_type"] == "Project"
        assert resp.data["activity"][0]["action"] == "Created Project"
        assert resp.data["schedule"]["days_total"] >= 1

    def test_switching_projects_returns_each_projects_data(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project_a = ProjectFactory.create(organization=org, code="SWA01")
        project_b = ProjectFactory.create(organization=org, code="SWB01")
        ShotFactory.create(organization=org, project=project_a, code="SHA01", status="Approved")
        ShotFactory.create(organization=org, project=project_a, code="SHA02", status="Approved")

        resp_a = staff_client.get(_dashboard_url(project_a), **_org_header(org))
        resp_b = staff_client.get(_dashboard_url(project_b), **_org_header(org))
        assert resp_a.data["summary"]["total_shots"] == 2
        assert resp_a.data["summary"]["shots_completion_pct"] == 100
        assert resp_b.data["summary"]["total_shots"] == 0

    def test_task_buckets_reconcile_with_total(self, staff_client, staff_user):
        """open+in_progress+blocked+review+completed == total (chart partition)."""
        org, project, _ = self._seed()
        grant_org_admin(staff_user, org)
        resp = staff_client.get(_dashboard_url(project), **_org_header(org))

        assert resp.status_code == status.HTTP_200_OK, resp.data
        tasks = resp.data["tasks"]
        assert (
            tasks["open"]
            + tasks["in_progress"]
            + tasks["blocked"]
            + tasks["review"]
            + tasks["completed"]
            == tasks["total"]
            == 4
        )
        assert tasks["critical"] == 1  # TSK002 overdue; nothing blocked
        assert sum(item["count"] for item in resp.data["production"]["status_breakdown"]) == 4
        reviews = resp.data["reviews"]
        assert (
            reviews["pending"]
            + reviews["approved"]
            + reviews["changes_requested"]
            + reviews["rejected"]
            == 2
        )

    def test_critical_counts_blocked_plus_overdue_union(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, code="CRIT01")
        today = timezone.localdate()
        TaskFactory.create(
            organization=org, project=project, code="CRIT-T1",
            status="Blocked", due_date=today - timedelta(days=1),
        )
        TaskFactory.create(
            organization=org, project=project, code="CRIT-T2",
            status="Not Started", due_date=today - timedelta(days=1),
        )
        TaskFactory.create(
            organization=org, project=project, code="CRIT-T3", status="Blocked",
        )
        resp = staff_client.get(_dashboard_url(project), **_org_header(org))

        assert resp.status_code == status.HTTP_200_OK, resp.data
        # Union, not sum: CRIT-T1 is both blocked and overdue.
        assert resp.data["tasks"]["overdue"] == 2
        assert resp.data["tasks"]["blocked"] == 2
        assert resp.data["tasks"]["critical"] == 3

    def test_workload_buckets_by_assignee(self, staff_client, staff_user):
        from apps.identity.tests.factories import UserFactory

        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, code="WL01")
        artist = UserFactory.create()
        today = timezone.localdate()
        for index in range(3):
            TaskFactory.create(
                organization=org, project=project, code=f"WLT00{index}",
                status="In Progress" if index == 0 else "Not Started",
                assignee=artist,
                due_date=today - timedelta(days=1) if index == 1 else None,
            )
        resp = staff_client.get(_dashboard_url(project), **_org_header(org))

        assert resp.status_code == status.HTTP_200_OK, resp.data
        members = resp.data["workload"]["team_members"]
        mine = next(m for m in members if m["id"] == f"user-{artist.id}")
        assert mine["assigned_count"] == 3
        assert mine["in_progress_count"] == 1
        assert mine["overdue_count"] == 1
        assert mine["workload_level"] == "high"


@pytest.mark.django_db
class TestProjectDashboardNestedFallback:
    def test_nested_route_matches_primary_payload(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, code="NEST01")
        ShotFactory.create(organization=org, project=project, code="SHN01", status="Approved")

        primary = staff_client.get(_dashboard_url(project), **_org_header(org))
        nested = staff_client.get(_nested_url(org, "nest01"))
        assert nested.status_code == status.HTTP_200_OK, nested.data
        assert nested.data["project"]["id"] == primary.data["project"]["id"]
        assert nested.data["summary"] == primary.data["summary"]

    def test_nested_unknown_project_404(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.get(_nested_url(org, "missing"))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_nested_cross_org_project_404(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        project_b = ProjectFactory.create(organization=org_b, code="XORG01")
        resp = staff_client.get(_nested_url(org_a, project_b.id))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_nested_non_member_forbidden(self, authenticated_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org, code="NMEM01")
        resp = authenticated_client.get(_nested_url(org, project.id))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestAnalyticsKpisContract:
    def test_kpis_match_production_kpis_shape(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, code="KPI01")
        ShotFactory.create(organization=org, project=project, code="SHK01", status="Approved")
        ShotFactory.create(organization=org, project=project, code="SHK02", status="In Progress")
        TaskFactory.create(
            organization=org, project=project, code="TSKK01", status="Approved",
        )

        resp = staff_client.get("/api/v1/analytics/kpis/", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        for key in (
            "total_active_projects", "total_shots", "approved_shots",
            "pending_review_shots", "in_progress_shots", "approval_rate_percentage",
            "active_artists", "storage_usage_tb", "storage_quota_tb",
            "render_nodes_busy", "render_nodes_total", "average_render_time_mins",
        ):
            assert key in resp.data, key
        assert resp.data["total_active_projects"] == 1
        assert resp.data["total_shots"] == 2
        assert resp.data["approved_shots"] == 1
        assert resp.data["approval_rate_percentage"] == 50.0
        # Render-farm telemetry has no source: honest nulls, not literals.
        assert resp.data["render_nodes_busy"] is None
        assert resp.data["average_render_time_mins"] is None

    def test_archived_projects_excluded_from_active_count(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        ProjectFactory.create(organization=org, code="KPA01", status="In Progress")
        ProjectFactory.create(organization=org, code="KPA02", status="Archived")

        resp = staff_client.get("/api/v1/analytics/kpis/", **_org_header(org))
        assert resp.data["total_active_projects"] == 1
