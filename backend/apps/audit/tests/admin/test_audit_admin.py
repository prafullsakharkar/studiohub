"""
Admin tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.admin import (
    ActivityAdmin,
    APIRequestAdmin,
    AuditLogAdmin,
    BackgroundJobAdmin,
    ChangeLogAdmin,
    ErrorLogAdmin,
    LoginHistoryAdmin,
    TrackAdmin,
)


class TestAuditLogAdmin:
    """Tests for AuditLogAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert AuditLogAdmin.list_display == [
            "id",
            "action",
            "severity",
            "target_type",
            "target_id",
            "actor",
            "organization",
            "created_at",
        ]

    @pytest.mark.django_db
    def test_list_filter(self) -> None:
        """Verify the list filter fields."""
        assert "action" in AuditLogAdmin.list_filter
        assert "severity" in AuditLogAdmin.list_filter
        assert "target_type" in AuditLogAdmin.list_filter
        assert "created_at" in AuditLogAdmin.list_filter

    @pytest.mark.django_db
    def test_search_fields(self) -> None:
        """Verify the search fields."""
        assert "actor__email" in AuditLogAdmin.search_fields
        assert "organization__name" in AuditLogAdmin.search_fields

    @pytest.mark.django_db
    def test_readonly_fields(self) -> None:
        """Verify the readonly fields."""
        assert "created_at" in AuditLogAdmin.readonly_fields
        assert "updated_at" in AuditLogAdmin.readonly_fields

    @pytest.mark.django_db
    def test_registered(self) -> None:
        """Verify the admin is registered for AuditLog."""
        from django.contrib import admin

        from apps.audit.models.audit_log import AuditLog

        assert admin.site.is_registered(AuditLog)


class TestActivityAdmin:
    """Tests for ActivityAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "activity_type" in ActivityAdmin.list_display
        assert "status" in ActivityAdmin.list_display
        assert "description" in ActivityAdmin.list_display

    @pytest.mark.django_db
    def test_search_fields(self) -> None:
        """Verify the search fields."""
        assert "user__email" in ActivityAdmin.search_fields


class TestAPIRequestAdmin:
    """Tests for APIRequestAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "method" in APIRequestAdmin.list_display
        assert "status_code" in APIRequestAdmin.list_display
        assert "response_time_ms" in APIRequestAdmin.list_display

    @pytest.mark.django_db
    def test_list_filter(self) -> None:
        """Verify the list filter fields."""
        assert "method" in APIRequestAdmin.list_filter
        assert "status_code" in APIRequestAdmin.list_filter


class TestBackgroundJobAdmin:
    """Tests for BackgroundJobAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "job_type" in BackgroundJobAdmin.list_display
        assert "status" in BackgroundJobAdmin.list_display
        assert "started_at" in BackgroundJobAdmin.list_display


class TestChangeLogAdmin:
    """Tests for ChangeLogAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "change_type" in ChangeLogAdmin.list_display
        assert "target_type" in ChangeLogAdmin.list_display
        assert "user" in ChangeLogAdmin.list_display


class TestErrorLogAdmin:
    """Tests for ErrorLogAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "severity" in ErrorLogAdmin.list_display
        assert "error_type" in ErrorLogAdmin.list_display
        assert "message" in ErrorLogAdmin.list_display


class TestLoginHistoryAdmin:
    """Tests for LoginHistoryAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "user" in LoginHistoryAdmin.list_display
        assert "ip_address" in LoginHistoryAdmin.list_display
        assert "status" in LoginHistoryAdmin.list_display


class TestTrackAdmin:
    """Tests for TrackAdmin configuration."""

    @pytest.mark.django_db
    def test_list_display(self) -> None:
        """Verify the list display columns."""
        assert "event_type" in TrackAdmin.list_display
        assert "event_name" in TrackAdmin.list_display
        assert "user" in TrackAdmin.list_display
