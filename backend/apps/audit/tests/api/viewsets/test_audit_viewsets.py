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


class TestTrackIngest:
    """Client telemetry ingest (player/UI events resolve org server-side)."""

    @pytest.mark.django_db
    def test_ingest_track_with_aliases(self, staff_client) -> None:
        from apps.identity.tests.factories import UserFactory
        from apps.organization.tests.factories import (
            OrganizationFactory,
            OrganizationMembershipFactory,
        )

        user = UserFactory.create()
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(organization=org, user=user)
        user.set_password("password123")
        user.save()

        login = staff_client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "password123"},
            format="json",
        )
        token = login.data["tokens"]["access"]
        url = reverse("api:v1:audit:track-list")
        response = staff_client.post(
            url,
            {
                "event_type": "click",
                "track_name": "Shot card opened",
                "duration_ms": 120,
                "page_url": "/shots",
                "metadata": {"source": "test"},
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["event_name"] == "Shot card opened"
        assert response.data["metadata"]["duration_ms"] == 120
        assert str(response.data["organization"]) == str(org.id)


class TestChangeTrackingSignals:
    """Bounded receivers record creates/updates on tracked models."""

    @pytest.mark.django_db
    def test_create_and_update_record_changelog(self) -> None:
        from apps.audit.models import ChangeLog
        from apps.organization.tests.factories import OrganizationFactory
        from apps.production.tests.factories import ProjectFactory

        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org, name="Signal Test")
        created = ChangeLog.objects.filter(
            target_type="Project", target_id=str(project.pk), change_type="create"
        )
        assert created.count() == 1
        assert created.first().organization_id == org.id

        project.name = "Signal Test Renamed"
        project.save()
        updated = ChangeLog.objects.filter(
            target_type="Project", target_id=str(project.pk), change_type="update"
        )
        assert updated.count() == 1
        assert "name" in updated.first().changed_fields

    @pytest.mark.django_db
    def test_noop_save_records_nothing(self) -> None:
        from apps.audit.models import ChangeLog
        from apps.organization.tests.factories import OrganizationFactory
        from apps.production.tests.factories import ProjectFactory

        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org, name="Quiet")
        before = ChangeLog.objects.filter(target_id=str(project.pk)).count()
        project.save()
        after = ChangeLog.objects.filter(target_id=str(project.pk)).count()
        assert after == before


class TestTelemetryWriters:
    """Middleware + handler writers behind the observability pages."""

    @pytest.mark.django_db
    def test_api_middleware_records_request(self, staff_client) -> None:
        from apps.audit.models import APIRequest
        from apps.identity.tests.factories import UserFactory
        from apps.organization.tests.factories import (
            OrganizationFactory,
            OrganizationMembershipFactory,
        )

        user = UserFactory.create()
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(organization=org, user=user)
        user.set_password("password123")
        user.save()
        login = staff_client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "password123"},
            format="json",
        )
        token = login.data["tokens"]["access"]
        before = APIRequest.objects.count()
        staff_client.get(
            "/api/v1/projects/?page_size=1",
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        rows = APIRequest.objects.order_by("-created_at")[:1]
        assert APIRequest.objects.count() == before + 1
        row = rows[0]
        assert row.method == "GET"
        assert row.path == "/api/v1/projects/"
        assert row.status_category == "2xx"
        assert row.organization_id == org.id

    @pytest.mark.django_db
    def test_exception_handler_records_500(self) -> None:
        from rest_framework.test import APIRequestFactory

        from apps.audit.models import ErrorLog
        from apps.core.api.exceptions.handlers import custom_exception_handler
        from apps.identity.tests.factories import UserFactory
        from apps.organization.tests.factories import (
            OrganizationFactory,
            OrganizationMembershipFactory,
        )

        user = UserFactory.create()
        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(organization=org, user=user)
        factory = APIRequestFactory()
        request = factory.get("/api/v1/projects/")
        request.user = user
        request.organization = org
        response = custom_exception_handler(
            RuntimeError("boom"), {"request": request, "view": None}
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        row = ErrorLog.objects.order_by("-created_at").first()
        assert row is not None
        assert "boom" in row.message
        assert row.organization_id == org.id
