"""Audit reads are platform-global: no tenant partition (org-free)."""

from __future__ import annotations

import pytest

from apps.audit.tests.factories import AuditLogFactory


@pytest.mark.django_db
def test_audit_log_list_platform_global(admin_client):
    AuditLogFactory.create(description="row-a")
    AuditLogFactory.create(description="row-b")

    response = admin_client.get("/api/v1/audit/audit-logs/")

    assert response.status_code == 200, response.content[:500]
    payload = response.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    descriptions = [row["description"] for row in rows]
    assert "row-a" in descriptions
    assert "row-b" in descriptions


@pytest.mark.django_db
def test_audit_log_list_ignores_legacy_org_header(admin_client):
    """A stale X-Organization-Id header no longer filters audit rows."""
    AuditLogFactory.create(description="row-a")

    response = admin_client.get(
        "/api/v1/audit/audit-logs/",
        HTTP_X_ORGANIZATION_ID="00000000-0000-0000-0000-000000000000",
    )

    assert response.status_code == 200, response.content[:500]
    payload = response.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    assert [row["description"] for row in rows] == ["row-a"]
