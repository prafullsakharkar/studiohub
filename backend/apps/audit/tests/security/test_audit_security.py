# tests/security/test_audit_security.py
"""
Security tests for Audit application.

Audit records are append-only: the API is read-only (list/retrieve) and
requires authentication. These tests verify the security contract.
"""

from __future__ import annotations

import pytest
from django.db import connection
from django.urls import reverse
from rest_framework import status

from apps.audit.models.audit_log import AuditLog
from apps.audit.tests.factories import AuditLogFactory


class TestAuditLogSecurity:
    """Security tests for AuditLog model."""

    @pytest.mark.django_db
    def test_audit_log_uuid_is_unique(self) -> None:
        """Test that audit log UUIDs are unique."""
        log1 = AuditLogFactory()
        log2 = AuditLogFactory()
        assert log1.uuid != log2.uuid

    @pytest.mark.django_db
    def test_audit_log_audit_fields(self, audit_log: AuditLog) -> None:
        """Test audit fields are present and nullable."""
        assert audit_log.created_at is not None
        assert audit_log.updated_at is not None
        assert audit_log.created_by is None
        assert audit_log.updated_by is None

    @pytest.mark.django_db
    def test_audit_log_soft_delete(self, audit_log: AuditLog) -> None:
        """Test soft delete functionality."""
        log_id = audit_log.id
        audit_log.soft_delete()
        audit_log.refresh_from_db()
        assert audit_log.is_deleted is True
        assert audit_log.deleted_at is not None
        assert AuditLog.objects.filter(id=log_id).count() == 0
        assert AuditLog.all_objects.filter(id=log_id).count() == 1

    @pytest.mark.django_db
    def test_audit_log_action_choices(self, audit_log: AuditLog) -> None:
        """Test action field choices."""
        valid_actions = [code for code, _ in AuditLog.ACTION_CHOICES]
        assert audit_log.action in valid_actions

    @pytest.mark.django_db
    def test_audit_log_timestamps(self, audit_log: AuditLog) -> None:
        """Test timestamps are set correctly."""
        assert audit_log.created_at is not None
        assert audit_log.updated_at is not None


class TestAuditLogAPIPermissions:
    """Permission tests for AuditLog API (read-only)."""

    def _list_url(self):
        return reverse("api:v1:audit:audit-log-list")

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view(self, api_client) -> None:
        """Anonymous users cannot view audit logs."""
        response = api_client.get(self._list_url())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_authenticated_user_can_view(
        self, authenticated_client
    ) -> None:
        """Authenticated users can view audit logs."""
        response = authenticated_client.get(self._list_url())
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_authenticated_user_cannot_create(
        self, authenticated_client
    ) -> None:
        """Audit records are append-only; create is not exposed."""
        response = authenticated_client.post(
            self._list_url(), {}, format="json"
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    @pytest.mark.django_db
    def test_authenticated_user_cannot_update(
        self, authenticated_client, audit_log: AuditLog
    ) -> None:
        """Audit records cannot be modified through the API."""
        url = reverse(
            "api:v1:audit:audit-log-detail",
            kwargs={"uuid": audit_log.uuid},
        )
        response = authenticated_client.patch(url, {}, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete(
        self, authenticated_client, audit_log: AuditLog
    ) -> None:
        """Audit records cannot be deleted through the API."""
        url = reverse(
            "api:v1:audit:audit-log-detail",
            kwargs={"uuid": audit_log.uuid},
        )
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


class TestAuditLogAPISQLInjection:
    """SQL injection prevention tests for AuditLog API."""

    def _list_url(self):
        return reverse("api:v1:audit:audit-log-list")

    @pytest.mark.django_db
    def test_sql_injection_in_search_query(
        self, staff_client
    ) -> None:
        """SQL injection in query params is treated as data, not SQL."""
        AuditLogFactory()
        malicious_query = "'; DROP TABLE audit_logs; --"
        response = staff_client.get(
            f"{self._list_url()}?search={malicious_query}"
        )
        assert response.status_code == status.HTTP_200_OK
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM audit_logs LIMIT 1")
            assert cursor.fetchone() is not None

    @pytest.mark.django_db
    def test_sql_injection_in_filter(self, staff_client) -> None:
        """SQL injection in filter params is treated as data, not SQL."""
        AuditLogFactory()
        malicious_filter = "1=1; DROP TABLE audit_logs; --"
        response = staff_client.get(
            f"{self._list_url()}?action={malicious_filter}"
        )
        assert response.status_code == status.HTTP_200_OK
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM audit_logs LIMIT 1")
            assert cursor.fetchone() is not None
