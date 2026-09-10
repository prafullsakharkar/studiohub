"""
Contract tests for the flat ``GET /api/v1/audit/`` alias (AuditLogsPage).

The page calls the flat path (not ``audit-logs/``) with ``search`` + ``action``
params and renders the frontend ``AuditLog`` shape (``entity_*/user_*``), so
the alias serializes that shape while reusing the read-only
selector/filter/permission stack. Audit stays append-only: POST is not routed.
"""

import pytest
from rest_framework import status

from apps.audit.tests.factories import AuditLogFactory
from apps.identity.tests.factories import ProfileFactory, UserFactory
from apps.organization.tests.factories import OrganizationFactory


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


@pytest.mark.django_db
class TestAuditFlatAlias:
    def _make_log(self, org, **kwargs):
        actor = UserFactory.create(email="alex.chen@example.com")
        ProfileFactory.create(user=actor, first_name="Alex", last_name="Chen")
        defaults = {
            "organization": org,
            "actor": actor,
            "action": "UPDATE",
            "target_type": "Shot",
            "target_id": "shot-001",
            "target_name": "NK_010_010",
            "description": "Color pipelineorov streamlined",
        }
        defaults.update(kwargs)
        return AuditLogFactory.create(**defaults)

    def test_list_frontend_shape(self, staff_client):
        org = OrganizationFactory.create()
        log = self._make_log(org)

        resp = staff_client.get("/api/v1/audit/", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        row = resp.data["results"][0]
        assert row["id"] == str(log.id)
        assert row["organization_id"] == str(org.id)
        assert row["user_id"] == str(log.actor_id)
        assert row["user_name"] == "Alex Chen"
        assert row["user_email"] == "alex.chen@example.com"
        assert row["action"] == "UPDATE"
        assert row["entity_type"] == "Shot"
        assert row["entity_id"] == "shot-001"
        assert row["entity_code"] == "NK_010_010"
        assert "description" in row and "ip_address" in row

    def test_search_and_action_filter(self, staff_client):
        org = OrganizationFactory.create()
        self._make_log(org, action="UPDATE", target_type="Shot")
        self._make_log(
            org,
            action="APPROVE",
            target_type="Review",
            target_id="rev-001",
            target_name="REV-01",
            description="Approved final comp",
        )

        resp = staff_client.get("/api/v1/audit/?search=comp", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["action"] == "APPROVE"

        resp = staff_client.get("/api/v1/audit/?action=UPDATE", **_org_header(org))
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["entity_type"] == "Shot"

    def test_requires_auth_and_stays_read_only(self, staff_client):
        # NOTE: never inject the shared `api_client` fixture alongside an
        # authenticated one — the audit conftest derives all clients from a
        # single APIClient, so force_authenticate would leak between names.
        from rest_framework.test import APIClient

        org = OrganizationFactory.create()
        self._make_log(org)

        resp = APIClient().get("/api/v1/audit/", **_org_header(org))
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

        resp = staff_client.post("/api/v1/audit/", {}, format="json", **_org_header(org))
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
