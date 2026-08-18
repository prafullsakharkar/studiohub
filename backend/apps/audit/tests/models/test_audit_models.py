# tests/models/test_audit_models.py
"""
Model tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.models.activity import Activity
from apps.audit.models.api_request import APIRequest
from apps.audit.models.audit_log import AuditLog
from apps.audit.models.background_job import BackgroundJob
from apps.audit.models.change_log import ChangeLog
from apps.audit.models.error_log import ErrorLog
from apps.audit.models.login_history import LoginHistory
from apps.audit.models.track import Track


def _assert_soft_delete(obj) -> None:
    """Soft-delete an object and verify the soft-delete contract."""
    obj_id = obj.id
    obj.soft_delete()
    obj.refresh_from_db()
    assert obj.is_deleted is True
    assert obj.deleted_at is not None
    assert obj.__class__.objects.filter(id=obj_id).count() == 0
    assert obj.__class__.all_objects.filter(id=obj_id).count() == 1


class TestAuditLogModel:
    """Tests for AuditLog model."""

    @pytest.mark.django_db
    def test_create_audit_log(self, audit_log: AuditLog) -> None:
        """Test creating an audit log instance."""
        assert audit_log.uuid is not None
        assert audit_log.action is not None

    @pytest.mark.django_db
    def test_audit_log_str_method(self, audit_log: AuditLog) -> None:
        """Test __str__ method."""
        assert str(audit_log) == (
            f"{audit_log.action}: {audit_log.target_type} {audit_log.target_id}"
        )

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
        _assert_soft_delete(audit_log)

    @pytest.mark.django_db
    def test_audit_log_action_choices(self, audit_log: AuditLog) -> None:
        """Test action field choices."""
        valid_actions = [
            code for code, _ in AuditLog.ACTION_CHOICES
        ]
        assert audit_log.action in valid_actions


class TestActivityModel:
    """Tests for Activity model."""

    @pytest.mark.django_db
    def test_create_activity(self, activity: Activity) -> None:
        """Test creating an activity instance."""
        assert activity.uuid is not None
        assert activity.activity_type is not None

    @pytest.mark.django_db
    def test_activity_str_method(self, activity: Activity) -> None:
        """Test __str__ method."""
        assert str(activity) == f"{activity.user.email}: {activity.activity_type}"

    @pytest.mark.django_db
    def test_activity_audit_fields(self, activity: Activity) -> None:
        """Test audit fields are present and nullable."""
        assert activity.created_at is not None
        assert activity.updated_at is not None
        assert activity.created_by is None
        assert activity.updated_by is None

    @pytest.mark.django_db
    def test_activity_soft_delete(self, activity: Activity) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(activity)


class TestAPIRequestModel:
    """Tests for APIRequest model."""

    @pytest.mark.django_db
    def test_create_api_request(self, api_request: APIRequest) -> None:
        """Test creating an API request instance."""
        assert api_request.uuid is not None
        assert api_request.method is not None

    @pytest.mark.django_db
    def test_api_request_str_method(self, api_request: APIRequest) -> None:
        """Test __str__ method."""
        assert str(api_request) == (
            f"{api_request.method} {api_request.path} ({api_request.status_code})"
        )

    @pytest.mark.django_db
    def test_api_request_audit_fields(self, api_request: APIRequest) -> None:
        """Test audit fields are present and nullable."""
        assert api_request.created_at is not None
        assert api_request.updated_at is not None
        assert api_request.created_by is None
        assert api_request.updated_by is None

    @pytest.mark.django_db
    def test_api_request_soft_delete(self, api_request: APIRequest) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(api_request)


class TestBackgroundJobModel:
    """Tests for BackgroundJob model."""

    @pytest.mark.django_db
    def test_create_background_job(self, background_job: BackgroundJob) -> None:
        """Test creating a background job instance."""
        assert background_job.uuid is not None
        assert background_job.job_type is not None

    @pytest.mark.django_db
    def test_background_job_str_method(
        self, background_job: BackgroundJob
    ) -> None:
        """Test __str__ method."""
        assert str(background_job) == (
            f"{background_job.job_type}: {background_job.job_id} "
            f"({background_job.status})"
        )

    @pytest.mark.django_db
    def test_background_job_audit_fields(
        self, background_job: BackgroundJob
    ) -> None:
        """Test audit fields are present and nullable."""
        assert background_job.created_at is not None
        assert background_job.updated_at is not None
        assert background_job.created_by is None
        assert background_job.updated_by is None

    @pytest.mark.django_db
    def test_background_job_soft_delete(
        self, background_job: BackgroundJob
    ) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(background_job)

    @pytest.mark.django_db
    def test_background_job_status_choices(
        self, background_job: BackgroundJob
    ) -> None:
        """Test status field choices."""
        valid_statuses = [code for code, _ in BackgroundJob.STATUS_CHOICES]
        assert background_job.status in valid_statuses


class TestChangeLogModel:
    """Tests for ChangeLog model."""

    @pytest.mark.django_db
    def test_create_change_log(self, change_log: ChangeLog) -> None:
        """Test creating a change log instance."""
        assert change_log.uuid is not None
        assert change_log.change_type is not None

    @pytest.mark.django_db
    def test_change_log_str_method(self, change_log: ChangeLog) -> None:
        """Test __str__ method."""
        assert str(change_log) == (
            f"{change_log.change_type}: {change_log.target_type} "
            f"{change_log.target_id}"
        )

    @pytest.mark.django_db
    def test_change_log_audit_fields(self, change_log: ChangeLog) -> None:
        """Test audit fields are present and nullable."""
        assert change_log.created_at is not None
        assert change_log.updated_at is not None
        assert change_log.created_by is None
        assert change_log.updated_by is None

    @pytest.mark.django_db
    def test_change_log_soft_delete(self, change_log: ChangeLog) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(change_log)


class TestErrorLogModel:
    """Tests for ErrorLog model."""

    @pytest.mark.django_db
    def test_create_error_log(self, error_log: ErrorLog) -> None:
        """Test creating an error log instance."""
        assert error_log.uuid is not None
        assert error_log.error_type is not None

    @pytest.mark.django_db
    def test_error_log_str_method(self, error_log: ErrorLog) -> None:
        """Test __str__ method."""
        assert str(error_log) == (
            f"{error_log.error_type}: {error_log.message[:100]}"
        )

    @pytest.mark.django_db
    def test_error_log_audit_fields(self, error_log: ErrorLog) -> None:
        """Test audit fields are present and nullable."""
        assert error_log.created_at is not None
        assert error_log.updated_at is not None
        assert error_log.created_by is None
        assert error_log.updated_by is None

    @pytest.mark.django_db
    def test_error_log_soft_delete(self, error_log: ErrorLog) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(error_log)

    @pytest.mark.django_db
    def test_error_log_severity_choices(self, error_log: ErrorLog) -> None:
        """Test severity field choices."""
        valid_severities = [code for code, _ in ErrorLog.SEVERITY_CHOICES]
        assert error_log.severity in valid_severities


class TestLoginHistoryModel:
    """Tests for LoginHistory model."""

    @pytest.mark.django_db
    def test_create_login_history(self, login_history: LoginHistory) -> None:
        """Test creating a login history instance."""
        assert login_history.uuid is not None
        assert login_history.login_type is not None

    @pytest.mark.django_db
    def test_login_history_str_method(
        self, login_history: LoginHistory
    ) -> None:
        """Test __str__ method."""
        assert str(login_history) == (
            f"{login_history.user.email}: {login_history.login_type} "
            f"({login_history.status})"
        )

    @pytest.mark.django_db
    def test_login_history_audit_fields(
        self, login_history: LoginHistory
    ) -> None:
        """Test audit fields are present and nullable."""
        assert login_history.created_at is not None
        assert login_history.updated_at is not None
        assert login_history.created_by is None
        assert login_history.updated_by is None

    @pytest.mark.django_db
    def test_login_history_soft_delete(
        self, login_history: LoginHistory
    ) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(login_history)


class TestTrackModel:
    """Tests for Track model."""

    @pytest.mark.django_db
    def test_create_track(self, track: Track) -> None:
        """Test creating a track instance."""
        assert track.uuid is not None
        assert track.event_type is not None

    @pytest.mark.django_db
    def test_track_str_method(self, track: Track) -> None:
        """Test __str__ method."""
        assert str(track) == (
            f"{track.user.email}: {track.event_type} - {track.event_name}"
        )

    @pytest.mark.django_db
    def test_track_audit_fields(self, track: Track) -> None:
        """Test audit fields are present and nullable."""
        assert track.created_at is not None
        assert track.updated_at is not None
        assert track.created_by is None
        assert track.updated_by is None

    @pytest.mark.django_db
    def test_track_soft_delete(self, track: Track) -> None:
        """Test soft delete functionality."""
        _assert_soft_delete(track)
