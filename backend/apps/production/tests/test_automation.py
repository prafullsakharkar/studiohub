"""
Tests for the persisted automation rules / audit-log endpoints.

Contract: studiohub-react `WorkflowService.ts` — bare-array lists, full rule
shape with nested `trigger`, 201 on create, 204 on delete; audit-logs
read-only list.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.organization.tests.factories import OrganizationFactory
from apps.production.models import AutomationAuditLog, AutomationRule, Workflow
from apps.production.services.automation import log_execution

RULES_URL = reverse("api:v1:production:automation-rules-list")
LOGS_URL = reverse("api:v1:production:automation-audit-logs")


def _rule_detail_url(rule_id):
    return reverse("api:v1:production:automation-rules-detail", kwargs={"pk": str(rule_id)})


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _rule_payload(**overrides):
    data = {
        "name": "Auto publish on approve",
        "description": "Publish versions when review approved",
        "trigger": {
            "event": "review.approved",
            "entity_type": "Review",
            "filters": {"project_code": "NK99"},
        },
        "conditions": [{"field": "status", "operator": "equals", "value": "Approved"}],
        "actions": [{"type": "publish_version", "label": "Publish", "order": 1}],
        "is_active": True,
        "required_role": "Supervisor",
    }
    data.update(overrides)
    return data


@pytest.mark.django_db
class TestAutomationRules:
    def test_unauthenticated_401(self, api_client):
        assert api_client.get(RULES_URL).status_code == 401
        assert api_client.post(RULES_URL, {}).status_code == 401

    def test_crud_round_trip(self, staff_client):
        org = OrganizationFactory.create()
        created = staff_client.post(RULES_URL, _rule_payload(), **_org_header(org), format="json")

        assert created.status_code == 201, created.data
        rule_id = created.data["id"]
        assert rule_id != "rule-001"
        assert created.data["trigger"] == {
            "event": "review.approved",
            "entity_type": "Review",
            "filters": {"project_code": "NK99"},
        }
        assert created.data["workflow_id"] is None
        assert created.data["execution_count"] == 0

        listed = staff_client.get(RULES_URL, **_org_header(org))
        assert [row["id"] for row in listed.data] == [rule_id]

        detail = staff_client.get(_rule_detail_url(rule_id))
        assert detail.status_code == 200

        patched = staff_client.patch(
            _rule_detail_url(rule_id), {"is_active": False}, format="json"
        )
        assert patched.status_code == 200
        assert patched.data["is_active"] is False

        put = staff_client.put(
            _rule_detail_url(rule_id), _rule_payload(name="Renamed"), format="json"
        )
        assert put.status_code == 200
        assert put.data["name"] == "Renamed"

        deleted = staff_client.delete(_rule_detail_url(rule_id))
        assert deleted.status_code == 204
        assert AutomationRule.objects.filter(id=rule_id).count() == 0

    def test_create_requires_name(self, staff_client):
        org = OrganizationFactory.create()
        payload = _rule_payload()
        del payload["name"]
        resp = staff_client.post(RULES_URL, payload, **_org_header(org), format="json")
        assert resp.status_code == 400

    def test_trigger_must_be_object(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(
            RULES_URL, _rule_payload(trigger="review.approved"), **_org_header(org), format="json"
        )
        assert resp.status_code == 400

    def test_workflow_linking(self, staff_client):
        org = OrganizationFactory.create()
        workflow = Workflow.objects.create(organization=org, name="Dailies", code="DAILIES")
        created = staff_client.post(
            RULES_URL,
            _rule_payload(workflow_id=str(workflow.id)),
            **_org_header(org),
            format="json",
        )
        assert created.status_code == 201, created.data
        assert created.data["workflow_id"] == str(workflow.id)

    def test_mock_workflow_id_ignored(self, staff_client):
        org = OrganizationFactory.create()
        created = staff_client.post(
            RULES_URL, _rule_payload(workflow_id="wf-001"), **_org_header(org), format="json"
        )
        assert created.status_code == 201, created.data
        assert created.data["workflow_id"] is None

    def test_org_isolation(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        rule = AutomationRule.objects.create(organization=org_a, name="A-rule")

        assert staff_client.get(RULES_URL, **_org_header(org_b)).data == []
        assert staff_client.get(_rule_detail_url(rule.id), **_org_header(org_b)).status_code == 404
        assert (
            staff_client.delete(_rule_detail_url(rule.id), **_org_header(org_b)).status_code
            == 404
        )

    def test_detail_invalid_pk_404(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.get(_rule_detail_url("not-a-uuid"), **_org_header(org))
        assert resp.status_code == 404

    def test_no_organization_404_on_create(self, staff_client):
        resp = staff_client.post(RULES_URL, _rule_payload(), format="json")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestAutomationAuditLogs:
    def test_unauthenticated_401(self, api_client):
        assert api_client.get(LOGS_URL).status_code == 401

    def test_list_empty_then_logged(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        assert staff_client.get(LOGS_URL, **_org_header(org)).data == []

        workflow = Workflow.objects.create(organization=org, name="Dailies", code="DAILIES")
        rule = AutomationRule.objects.create(
            organization=org, workflow=workflow, name="Auto publish"
        )
        log_execution(
            organization=org,
            rule=rule,
            entity_type="Review",
            entity_id="rev-1",
            entity_code="REV001",
            actor=staff_user,
            actor_name="Sup",
            actor_role="Supervisor",
            duration_ms=120,
            status="success",
            step_logs=[{"step": "publish", "action_type": "publish", "status": "success"}],
        )

        listed = staff_client.get(LOGS_URL, **_org_header(org))
        assert listed.status_code == 200
        assert len(listed.data) == 1
        row = listed.data[0]
        assert row["rule_id"] == str(rule.id)
        assert row["rule_name"] == "Auto publish"
        assert row["workflow_id"] == str(workflow.id)
        assert row["workflow_name"] == "Dailies"
        assert row["actor_id"] == str(staff_user.id)
        assert row["duration_ms"] == 120
        assert row["step_logs"][0]["step"] == "publish"

    def test_org_isolation(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        log_execution(organization=org_a, rule=None, trigger_event="x")

        assert staff_client.get(LOGS_URL, **_org_header(org_b)).data == []
        assert AutomationAuditLog.objects.filter(organization=org_a).count() == 1
