"""
Tests for platform-global AI insights endpoints.

Contract: studiohub-react `AIService.ts` — bare-array risk/recommendation
lists, project/shot summaries by code, rule-based chat, permission context.

All responses must be derived from real production data (no illustrative
literals) and are organization-free.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import UserFactory
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
)


def _url(name, **kwargs):
    return reverse(f"api:v1:intelligence:{name}", kwargs=kwargs or None)


class TestAIChat:
    @pytest.mark.django_db
    def test_unauthenticated_401(self, api_client):
        assert api_client.get(_url("intelligence-ai-chat")).status_code == 401

    @pytest.mark.django_db
    def test_get_returns_assistant_greeting(self, staff_client):
        resp = staff_client.get(_url("intelligence-ai-chat"))
        assert resp.status_code == 200
        messages = resp.json()
        assert isinstance(messages, list) and messages
        assert messages[0]["sender"] == "assistant"
        assert "StudioHub" in messages[0]["content"]

    @pytest.mark.django_db
    def test_post_risk_query_returns_real_risks(self, staff_client):
        project = ProjectFactory.create()
        TaskFactory.create(
            project=project,
            title="Late comp",
            department="Comp",
            status="In Progress",
            priority="High",
            due_date="2020-01-01",
        )
        resp = staff_client.post(
            _url("intelligence-ai-chat"),
            {"message": "what are the schedule risks?"},
            format="json",
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["capability_used"] == "risk_detection"
        assert "Late comp" in body["content"]

    @pytest.mark.django_db
    def test_delete_returns_204(self, staff_client):
        resp = staff_client.delete(_url("intelligence-ai-chat"))
        assert resp.status_code == 204


class TestAIRisks:
    @pytest.mark.django_db
    def test_returns_empty_when_no_data(self, staff_client):
        resp = staff_client.get(_url("intelligence-ai-risks"))
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.django_db
    def test_detects_overdue_task_risk(self, staff_client):
        project = ProjectFactory.create()
        TaskFactory.create(
            project=project,
            title="Missed deadline",
            department="Comp",
            status="In Progress",
            due_date="2020-01-01",
        )
        resp = staff_client.get(_url("intelligence-ai-risks"))
        assert resp.status_code == 200
        risks = resp.json()
        assert risks
        schedule = [r for r in risks if r["category"] == "schedule"]
        assert schedule
        assert "Missed deadline" in schedule[0]["description"]
        assert schedule[0]["project_code"] == project.code


class AIRisksResolveMixin:
    URL = "intelligence-ai-risks-resolve"

    @pytest.mark.django_db
    def test_resolve_is_advisory(self, staff_client):
        resp = staff_client.post(
            _url(self.URL), {"risk_id": "risk-schedule-0"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestAIRisksResolve(AIRisksResolveMixin):
    pass


class TestAITaskRecommendations:
    @pytest.mark.django_db
    def test_returns_empty_when_no_data(self, staff_client):
        resp = staff_client.get(_url("intelligence-ai-task-recommendations"))
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.django_db
    def test_recommends_least_loaded_assignee(self, staff_client):
        project = ProjectFactory.create()
        candidate = TaskFactory.create(
            project=project,
            title="Unassigned hero",
            department="Comp",
            priority="Critical",
            status="Not Started",
            assignee_id=None,
        )
        peer_user = UserFactory.create()
        TaskFactory.create(
            project=project,
            title="Peer task",
            department="Comp",
            priority="Medium",
            status="In Progress",
            assignee=peer_user,
        )
        resp = staff_client.get(_url("intelligence-ai-task-recommendations"))
        assert resp.status_code == 200
        recs = resp.json()
        assert recs
        match = [r for r in recs if r["task_id"] == str(candidate.id)]
        assert match
        assert match[0]["recommended_assignee_id"] == str(peer_user.id)
        assert match[0]["current_assignee_name"] == "Unassigned"


class TestAIProjectSummary:
    @pytest.mark.django_db
    def test_404_when_missing(self, staff_client):
        resp = staff_client.get(
            _url("intelligence-ai-project-summary", project_code="NOPE")
        )
        assert resp.status_code == 404

    @pytest.mark.django_db
    def test_real_aggregation(self, staff_client):
        project = ProjectFactory.create(code="TEST01")
        ShotFactory.create(project=project, code="S_A", status="Approved")
        ShotFactory.create(project=project, code="S_B", status="In Progress")
        resp = staff_client.get(
            _url("intelligence-ai-project-summary", project_code="TEST01")
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["project_code"] == "TEST01"
        assert body["project_name"] == project.name
        assert body["key_metrics"]["shots_total"] == 2
        assert body["key_metrics"]["shots_completed"] == 1
        assert body["health_score"] >= 0
        assert body["health_score"] <= 100


class TestAIShotSummary:
    @pytest.mark.django_db
    def test_404_when_missing(self, staff_client):
        resp = staff_client.get(
            _url("intelligence-ai-shot-summary", shot_code="NOPE")
        )
        assert resp.status_code == 404

    @pytest.mark.django_db
    def test_real_aggregation(self, staff_client):
        project = ProjectFactory.create(code="TEST01")
        shot = ShotFactory.create(project=project, code="SHOTX")
        TaskFactory.create(
            project=project,
            title="Active task",
            entity_type="Shot",
            entity_id=str(shot.id),
            entity_code=shot.code,
            status="In Progress",
        )
        resp = staff_client.get(
            _url("intelligence-ai-shot-summary", shot_code="SHOTX")
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["shot_code"] == "SHOTX"
        assert body["project_code"] == "TEST01"
        assert body["active_tasks_count"] == 1
        assert "1001-1100" in body["frame_range"]


class TestAIPermissionContext:
    @pytest.mark.django_db
    def test_real_context(self, staff_client):
        ProjectFactory.create(code="CTX01")
        resp = staff_client.get(_url("intelligence-ai-permission-context"))
        assert resp.status_code == 200
        body = resp.json()
        assert body["active_organization_id"] == ""
        assert body["active_organization_name"] == ""
        assert body["active_project_code"] == "CTX01"
        assert body["is_isolated"] is False


class TestAIRecommendationsApply:
    @pytest.mark.django_db
    def test_apply_is_advisory(self, staff_client):
        resp = staff_client.post(
            _url("intelligence-ai-task-recommendations-apply"),
            {"recommendation_id": "x", "task_id": "x"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
