"""
Contract tests for audit filtering, scoping aliases, and flat endpoints.

Frontend contract (studiohub-react ``modules/audit`` + ``organizationApi``):

* ``GET /api/v1/audit/`` with ``?action=&search=`` (paginated)
* ``GET /api/v1/audit/<uuid>/`` detail in the same frontend shape
* ``GET /api/v1/activity/`` flat fallback for ``getActivity()``
* Namespaced resources (``change-logs``, ``tracks``, ``background-jobs``,
  ``error-logs``, ``login-history``, ``api-requests``) with exact-match
  filters, search, ordering, and pagination.

Audit rows are platform-global: no tenant partition. The legacy
``?organization_id=`` query param and ``X-Organization-Id`` header are
ignored (no org filter remains).

Every filter test carries a negative control: rows that must be excluded.
"""

import pytest
from rest_framework import status

from apps.audit.models import Track
from apps.audit.tests.factories import (
    AuditLogFactory,
    ChangeLogFactory,
    TrackFactory,
)
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestAuditPlatformGlobalAlias:
    def test_audit_logs_are_platform_global(self, staff_client):
        AuditLogFactory.create(action="UPDATE", target_type="Shot")
        AuditLogFactory.create(action="APPROVE", target_type="Review")

        resp = staff_client.get("/api/v1/audit/")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 2

    def test_organization_id_param_is_ignored(self, staff_client):
        AuditLogFactory.create(action="UPDATE", target_type="Shot")
        AuditLogFactory.create(action="APPROVE", target_type="Review")

        resp = staff_client.get(
            "/api/v1/audit/?organization_id=00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 2

    def test_legacy_org_header_is_ignored(self, authenticated_client):
        AuditLogFactory.create(action="UPDATE", target_type="Shot")
        AuditLogFactory.create(action="APPROVE", target_type="Review")

        resp = authenticated_client.get(
            "/api/v1/audit/",
            HTTP_X_ORGANIZATION_ID="00000000-0000-0000-0000-000000000000",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 2


@pytest.mark.django_db
class TestAuditFlatDetail:
    def test_detail_returns_frontend_shape(self, staff_client):
        log = AuditLogFactory.create(
            action="APPROVE", target_type="Review",
            target_id="rev-1", target_name="REV-1",
        )
        resp = staff_client.get(f"/api/v1/audit/{log.uuid}/")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["id"] == str(log.id)
        assert resp.data["entity_type"] == "Review"
        assert resp.data["entity_id"] == "rev-1"
        assert resp.data["user_id"] == str(log.actor_id)

    def test_detail_unknown_uuid_404(self, staff_client):
        resp = staff_client.get(
            "/api/v1/audit/00000000-0000-0000-0000-000000000000/",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_flat_alias_stays_append_only(self, staff_client):
        resp = staff_client.post("/api/v1/audit/", data={})
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
class TestActivityFlatAlias:
    def test_v1_activity_fallback_is_paginated(self, staff_client):
        resp = staff_client.get("/api/v1/activity/")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert set(("count", "next", "previous", "results")) <= set(resp.data)


@pytest.mark.django_db
class TestNamespacedFilteringRegression:
    """Filters on namespaced resources must apply (negative controls)."""

    def test_change_logs_filter_by_change_type(self, staff_client):
        ChangeLogFactory.create(
            change_type="create", target_type="Shot", target_id="s-1"
        )
        ChangeLogFactory.create(
            change_type="update", target_type="Shot", target_id="s-2"
        )
        resp = staff_client.get(
            "/api/v1/audit/change-logs/?change_type=create&target_type=Shot",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["target_id"] == "s-1"

    def test_tracks_filter_by_event_type(self, staff_client):
        TrackFactory.create(event_type=Track.EVENT_CLICK)
        TrackFactory.create(event_type=Track.EVENT_FORM_SUBMIT)
        resp = staff_client.get(
            f"/api/v1/audit/tracks/?event_type={Track.EVENT_CLICK}",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["event_type"] == Track.EVENT_CLICK

    def test_tracks_search_and_ordering(self, staff_client):
        TrackFactory.create(
            event_type=Track.EVENT_CLICK, event_name="open-shot"
        )
        TrackFactory.create(
            event_type=Track.EVENT_CLICK, event_name="close-shot"
        )
        resp = staff_client.get(
            "/api/v1/audit/tracks/?search=open-shot&ordering=-created_at",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["event_name"] == "open-shot"

    def test_change_logs_before_after_and_actor_shape(self, staff_client):
        actor = UserFactory.create(email="sam.rivera@example.com")
        ChangeLogFactory.create(
            user=actor, change_type="update",
            target_type="Task", target_id="t-9", target_name="TSK-9",
            before_values={"status": "Not Started"},
            after_values={"status": "In Progress"},
            changed_fields=["status"],
        )
        resp = staff_client.get("/api/v1/audit/change-logs/")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        row = resp.data["results"][0]
        assert row["before_values"] == {"status": "Not Started"}
        assert row["after_values"] == {"status": "In Progress"}
        assert row["changed_fields"] == ["status"]
        assert row["user_email"] == "sam.rivera@example.com"
