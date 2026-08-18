"""
Filter tests for Audit application.

These test the canonical filter classes (``apps.audit.filters.*``) that the
audit viewsets wire into their querysets.
"""

from __future__ import annotations

import pytest

from apps.audit.filters.activity import ActivityFilter
from apps.audit.filters.api_request import APIRequestFilter
from apps.audit.filters.audit_log import AuditLogFilter
from apps.audit.filters.background_job import BackgroundJobFilter
from apps.audit.filters.change_log import ChangeLogFilter
from apps.audit.filters.error_log import ErrorLogFilter
from apps.audit.filters.login_history import LoginHistoryFilter
from apps.audit.filters.track import TrackFilter
from apps.audit.models.activity import Activity
from apps.audit.models.api_request import APIRequest
from apps.audit.models.audit_log import AuditLog
from apps.audit.models.background_job import BackgroundJob
from apps.audit.models.change_log import ChangeLog
from apps.audit.models.error_log import ErrorLog
from apps.audit.models.login_history import LoginHistory
from apps.audit.models.track import Track
from apps.audit.tests.factories import (
    ActivityFactory,
    APIRequestFactory,
    AuditLogFactory,
    BackgroundJobFactory,
    ChangeLogFactory,
    ErrorLogFactory,
    LoginHistoryFactory,
    TrackFactory,
)


class TestAuditLogFilter:
    """Tests for AuditLogFilter."""

    @pytest.mark.django_db
    def test_filter_by_action(self) -> None:
        """Filter audit logs by action."""
        log1 = AuditLogFactory(action=AuditLog.ACTION_CREATE)
        log2 = AuditLogFactory(action=AuditLog.ACTION_UPDATE)
        filterset = AuditLogFilter(
            AuditLog.objects.all(),
            data={"action": AuditLog.ACTION_CREATE},
        )
        assert log1 in filterset.qs
        assert log2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_severity(self) -> None:
        """Filter audit logs by severity."""
        from apps.audit.choices.audit_log import AuditSeverity

        log1 = AuditLogFactory(severity=AuditSeverity.INFO)
        log2 = AuditLogFactory(severity=AuditSeverity.CRITICAL)
        filterset = AuditLogFilter(
            AuditLog.objects.all(),
            data={"severity": AuditSeverity.INFO},
        )
        assert log1 in filterset.qs
        assert log2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_target_type(self) -> None:
        """Filter audit logs by target type."""
        log1 = AuditLogFactory(target_type=AuditLog.TARGET_MATCH)
        log2 = AuditLogFactory(target_type=AuditLog.TARGET_USER)
        filterset = AuditLogFilter(
            AuditLog.objects.all(),
            data={"target_type": AuditLog.TARGET_MATCH},
        )
        assert log1 in filterset.qs
        assert log2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_actor(self) -> None:
        """Filter audit logs by actor."""
        log1 = AuditLogFactory()
        log2 = AuditLogFactory()
        filterset = AuditLogFilter(
            AuditLog.objects.all(),
            data={"actor": str(log1.actor_id)},
        )
        assert log1 in filterset.qs
        assert log2 not in filterset.qs

    @pytest.mark.django_db
    def test_empty_data_returns_all(self) -> None:
        """Empty query params return the full queryset."""
        AuditLogFactory()
        AuditLogFactory()
        filterset = AuditLogFilter(AuditLog.objects.all(), data={})
        assert filterset.qs.count() == AuditLog.objects.count()


class TestActivityFilter:
    """Tests for ActivityFilter."""

    @pytest.mark.django_db
    def test_filter_by_activity_type(self) -> None:
        """Filter activities by type."""
        activity1 = ActivityFactory(activity_type=Activity.TYPE_PAGE_VIEW)
        activity2 = ActivityFactory(activity_type=Activity.TYPE_FEATURE_USAGE)
        filterset = ActivityFilter(
            Activity.objects.all(),
            data={"activity_type": Activity.TYPE_PAGE_VIEW},
        )
        assert activity1 in filterset.qs
        assert activity2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_status(self) -> None:
        """Filter activities by status."""
        activity1 = ActivityFactory(status=Activity.STATUS_SUCCESS)
        activity2 = ActivityFactory(status=Activity.STATUS_FAILED)
        filterset = ActivityFilter(
            Activity.objects.all(),
            data={"status": Activity.STATUS_SUCCESS},
        )
        assert activity1 in filterset.qs
        assert activity2 not in filterset.qs


class TestAPIRequestFilter:
    """Tests for APIRequestFilter."""

    @pytest.mark.django_db
    def test_filter_by_method(self) -> None:
        """Filter API requests by HTTP method."""
        req1 = APIRequestFactory(method="GET")
        req2 = APIRequestFactory(method="POST")
        filterset = APIRequestFilter(
            APIRequest.objects.all(),
            data={"method": "GET"},
        )
        assert req1 in filterset.qs
        assert req2 not in filterset.qs

    @pytest.mark.django_db
    def test_filter_by_status_code(self) -> None:
        """Filter API requests by status code."""
        req1 = APIRequestFactory(status_code=200)
        req2 = APIRequestFactory(status_code=500)
        filterset = APIRequestFilter(
            APIRequest.objects.all(),
            data={"status_code": "200"},
        )
        assert req1 in filterset.qs
        assert req2 not in filterset.qs


class TestBackgroundJobFilter:
    """Tests for BackgroundJobFilter."""

    @pytest.mark.django_db
    def test_filter_by_status(self) -> None:
        """Filter background jobs by status."""
        job1 = BackgroundJobFactory(status=BackgroundJob.STATUS_STARTED)
        job2 = BackgroundJobFactory(status=BackgroundJob.STATUS_COMPLETED)
        filterset = BackgroundJobFilter(
            BackgroundJob.objects.all(),
            data={"status": BackgroundJob.STATUS_STARTED},
        )
        assert job1 in filterset.qs
        assert job2 not in filterset.qs


class TestChangeLogFilter:
    """Tests for ChangeLogFilter."""

    @pytest.mark.django_db
    def test_filter_by_change_type(self) -> None:
        """Filter change logs by change type."""
        log1 = ChangeLogFactory(change_type="create")
        log2 = ChangeLogFactory(change_type="update")
        filterset = ChangeLogFilter(
            ChangeLog.objects.all(),
            data={"change_type": "create"},
        )
        assert log1 in filterset.qs
        assert log2 not in filterset.qs


class TestErrorLogFilter:
    """Tests for ErrorLogFilter."""

    @pytest.mark.django_db
    def test_filter_by_severity(self) -> None:
        """Filter error logs by severity."""
        log1 = ErrorLogFactory(severity="warning")
        log2 = ErrorLogFactory(severity="critical")
        filterset = ErrorLogFilter(
            ErrorLog.objects.all(),
            data={"severity": "warning"},
        )
        assert log1 in filterset.qs
        assert log2 not in filterset.qs


class TestLoginHistoryFilter:
    """Tests for LoginHistoryFilter."""

    @pytest.mark.django_db
    def test_filter_by_status(self) -> None:
        """Filter login history by status."""
        entry1 = LoginHistoryFactory(status="success")
        entry2 = LoginHistoryFactory(status="failed")
        filterset = LoginHistoryFilter(
            LoginHistory.objects.all(),
            data={"status": "success"},
        )
        assert entry1 in filterset.qs
        assert entry2 not in filterset.qs


class TestTrackFilter:
    """Tests for TrackFilter."""

    @pytest.mark.django_db
    def test_filter_by_event_type(self) -> None:
        """Filter tracks by event type."""
        track1 = TrackFactory(event_type=Track.EVENT_CLICK)
        track2 = TrackFactory(event_type=Track.EVENT_FORM_SUBMIT)
        filterset = TrackFilter(
            Track.objects.all(),
            data={"event_type": Track.EVENT_CLICK},
        )
        assert track1 in filterset.qs
        assert track2 not in filterset.qs
