"""
Serializer tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.serializers.activity import ActivitySerializer
from apps.audit.serializers.api_request import APIRequestSerializer
from apps.audit.serializers.audit_log import AuditLogSerializer
from apps.audit.serializers.background_job import BackgroundJobSerializer
from apps.audit.serializers.change_log import ChangeLogSerializer
from apps.audit.serializers.error_log import ErrorLogSerializer
from apps.audit.serializers.login_history import LoginHistorySerializer
from apps.audit.serializers.track import TrackSerializer
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


class TestAuditLogSerializer:
    """Tests for AuditLogSerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real audit log."""
        log = AuditLogFactory()
        serializer = AuditLogSerializer(log)
        data = serializer.data
        assert data["id"] == str(log.id)
        assert data["uuid"] == log.uuid
        assert data["action"] == log.action
        assert data["severity"] == log.severity
        assert data["target_type"] == log.target_type
        assert data["target_id"] == log.target_id
        assert data["actor"] == log.actor_id
        assert data["actor_email"] == log.actor.email
        assert data["organization"] == log.organization_id

    @pytest.mark.django_db
    def test_read_only_fields(self) -> None:
        """Read-only fields cannot be written through the serializer."""
        log = AuditLogFactory()
        serializer = AuditLogSerializer(
            log,
            data={"id": "999", "action": "create"},
            partial=True,
        )
        assert serializer.is_valid()
        # id/uuid/created_at/updated_at are read-only; only action applies.
        assert serializer.validated_data.get("id") is None


class TestActivitySerializer:
    """Tests for ActivitySerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real activity."""
        activity = ActivityFactory()
        serializer = ActivitySerializer(activity)
        data = serializer.data
        assert data["id"] == str(activity.id)
        assert data["activity_type"] == activity.activity_type
        assert data["status"] == activity.status


class TestAPIRequestSerializer:
    """Tests for APIRequestSerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real API request."""
        request = APIRequestFactory()
        serializer = APIRequestSerializer(request)
        data = serializer.data
        assert data["id"] == str(request.id)
        assert data["method"] == request.method
        assert data["path"] == request.path
        assert data["status_code"] == request.status_code


class TestBackgroundJobSerializer:
    """Tests for BackgroundJobSerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real background job."""
        job = BackgroundJobFactory()
        serializer = BackgroundJobSerializer(job)
        data = serializer.data
        assert data["id"] == str(job.id)
        assert data["job_type"] == job.job_type
        assert data["status"] == job.status


class TestChangeLogSerializer:
    """Tests for ChangeLogSerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real change log."""
        change_log = ChangeLogFactory()
        serializer = ChangeLogSerializer(change_log)
        data = serializer.data
        assert data["id"] == str(change_log.id)
        assert data["change_type"] == change_log.change_type
        assert data["target_type"] == change_log.target_type


class TestErrorLogSerializer:
    """Tests for ErrorLogSerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real error log."""
        error_log = ErrorLogFactory()
        serializer = ErrorLogSerializer(error_log)
        data = serializer.data
        assert data["id"] == str(error_log.id)
        assert data["severity"] == error_log.severity
        assert data["error_type"] == error_log.error_type


class TestLoginHistorySerializer:
    """Tests for LoginHistorySerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real login history entry."""
        entry = LoginHistoryFactory()
        serializer = LoginHistorySerializer(entry)
        data = serializer.data
        assert data["id"] == str(entry.id)
        assert data["login_type"] == entry.login_type
        assert data["status"] == entry.status


class TestTrackSerializer:
    """Tests for TrackSerializer."""

    @pytest.mark.django_db
    def test_serializes_instance(self) -> None:
        """Serializer produces expected data for a real track entry."""
        track = TrackFactory()
        serializer = TrackSerializer(track)
        data = serializer.data
        assert data["id"] == str(track.id)
        assert data["event_type"] == track.event_type
        assert data["event_name"] == track.event_name
