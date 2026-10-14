"""Audit reads follow the active organization, not all memberships."""

from __future__ import annotations

import pytest

from apps.audit.tests.factories import AuditLogFactory
from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_audit_log_list_scoped_to_active_organization(staff_client, staff_user):
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org_a)
    grant_all_known_codes(staff_user, org_b)
    AuditLogFactory.create(organization=org_a, description="row-a")
    AuditLogFactory.create(organization=org_b, description="row-b")

    response = staff_client.get(
        "/api/v1/audit/audit-logs/",
        HTTP_X_ORGANIZATION_ID=str(org_a.id),
    )

    assert response.status_code == 200, response.content[:500]
    payload = response.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    descriptions = [row["description"] for row in rows]
    assert "row-a" in descriptions
    assert "row-b" not in descriptions


@pytest.mark.django_db
def test_audit_log_list_without_header_keeps_member_orgs(staff_client, staff_user):
    org_a = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org_a)
    AuditLogFactory.create(organization=org_a, description="row-a")

    response = staff_client.get("/api/v1/audit/audit-logs/")

    assert response.status_code == 200, response.content[:500]
    payload = response.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    assert [row["description"] for row in rows] == ["row-a"]


@pytest.mark.django_db
def test_audit_log_list_foreign_header_grants_nothing(staff_client, staff_user):
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org_a)
    AuditLogFactory.create(organization=org_a, description="row-a")
    AuditLogFactory.create(organization=org_b, description="row-b")

    response = staff_client.get(
        "/api/v1/audit/audit-logs/",
        HTTP_X_ORGANIZATION_ID=str(org_b.id),
    )

    assert response.status_code == 200, response.content[:500]
    payload = response.json()
    rows = payload["results"] if isinstance(payload, dict) else payload
    descriptions = [row["description"] for row in rows]
    assert "row-a" in descriptions
    assert "row-b" not in descriptions
