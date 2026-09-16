# tests/api/viewsets/test_audit_viewsets.py
"""
ViewSet tests for Audit application.

AuditLogViewSet is read-only: audit records are append-only and written by
internal services, so the API only supports list and retrieve.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status

from apps.audit.models.audit_log import AuditLog
from apps.audit.tests.factories import AuditLogFactory


class TestAuditLogViewSet:
    """Tests for AuditLog ViewSet."""

    def _list_url(self):
        return reverse("api:v1:audit:audit-log-list")

    def _detail_url(self, audit_log):
        return reverse(
            "api:v1:audit:audit-log-detail",
            kwargs={"uuid": audit_log.uuid},
        )

    @pytest.mark.django_db
    def test_list_audit_logs(self, staff_client) -> None:
        """Test listing audit logs."""
        AuditLogFactory.create_batch(3)
        response = staff_client.get(self._list_url())
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_retrieve_audit_log(self, staff_client, audit_log: AuditLog) -> None:
        """Test retrieving a single audit log."""
        response = staff_client.get(self._detail_url(audit_log))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(audit_log.id)

    @pytest.mark.django_db
    def test_create_not_allowed(self, staff_client) -> None:
        """Audit records are append-only; create is not exposed."""
        response = staff_client.post(self._list_url(), {}, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    @pytest.mark.django_db
    def test_update_not_allowed(
        self, staff_client, audit_log: AuditLog
    ) -> None:
        """Audit records cannot be modified through the API."""
        response = staff_client.patch(
            self._detail_url(audit_log), {"description": "x"}, format="json"
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    @pytest.mark.django_db
    def test_delete_not_allowed(
        self, staff_client, audit_log: AuditLog
    ) -> None:
        """Audit records cannot be deleted through the API."""
        response = staff_client.delete(self._detail_url(audit_log))
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    @pytest.mark.django_db
    def test_filter_audit_logs_by_action(self, staff_client) -> None:
        """Test filtering audit logs by action."""
        AuditLogFactory.create_batch(
            2, action=AuditLog.ACTION_CREATE
        )
        response = staff_client.get(
            f"{self._list_url()}?action={AuditLog.ACTION_CREATE}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2


class TestAuditLogViewSetPermissions:
    """Permission tests for AuditLog ViewSet."""

    def _list_url(self):
        return reverse("api:v1:audit:audit-log-list")

    @pytest.mark.django_db
    def test_anonymous_user_cannot_list(self, api_client) -> None:
        """Anonymous users cannot list audit logs."""
        response = api_client.get(self._list_url())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_authenticated_user_can_list(self, authenticated_client) -> None:
        """Authenticated users can list audit logs."""
        response = authenticated_client.get(self._list_url())
        assert response.status_code == status.HTTP_200_OK


class TestBackgroundJobActions:
    """Retry/cancel actions (frontend job cards call these in both modes)."""

    @pytest.mark.django_db
    def test_retry_job_requeues(self, staff_client) -> None:
        from apps.audit.models.background_job import BackgroundJob
        from apps.audit.tests.factories import BackgroundJobFactory

        job = BackgroundJobFactory.create(
            status=BackgroundJob.STATUS_FAILED, progress=80
        )
        url = reverse(
            "api:v1:audit:background-job-retry", kwargs={"uuid": job.uuid}
        )
        response = staff_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        job.refresh_from_db()
        assert job.status == BackgroundJob.STATUS_QUEUED
        assert job.progress == 0

    @pytest.mark.django_db
    def test_cancel_job(self, staff_client) -> None:
        from apps.audit.models.background_job import BackgroundJob
        from apps.audit.tests.factories import BackgroundJobFactory

        job = BackgroundJobFactory.create(
            status=BackgroundJob.STATUS_PROGRESS, progress=40
        )
        url = reverse(
            "api:v1:audit:background-job-cancel", kwargs={"uuid": job.uuid}
        )
        response = staff_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        job.refresh_from_db()
        assert job.status == BackgroundJob.STATUS_CANCELLED

    @pytest.mark.django_db
    def test_resolve_error_log(self, staff_client) -> None:
        from apps.audit.tests.factories import ErrorLogFactory

        entry = ErrorLogFactory.create(resolved=False)
        url = reverse(
            "api:v1:audit:error-log-resolve", kwargs={"uuid": entry.uuid}
        )
        response = staff_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        entry.refresh_from_db()
        assert entry.resolved is True
