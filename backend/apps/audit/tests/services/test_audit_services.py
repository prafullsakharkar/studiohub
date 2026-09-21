# tests/services/test_audit_services.py
"""
Service tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.models.background_job import BackgroundJob
from apps.audit.services.audit_log import AuditLogService
from apps.audit.services.background_job import BackgroundJobService


class TestAuditLogService:
    """Tests for AuditLog service."""

    @pytest.mark.django_db
    def test_service_create_audit_log(self, organization, user) -> None:
        """Test service create_log method."""
        audit_log = AuditLogService.create_log(
            organization=organization,
            actor=user,
            action=AuditLog.ACTION_CREATE,
            target_type="TestModel",
            target_id="123",
            target_name="Test",
            description="Created",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
        assert audit_log.uuid is not None
        assert audit_log.action == AuditLog.ACTION_CREATE
        assert audit_log.target_type == "TestModel"
        assert audit_log.actor_id == user.id

    @pytest.mark.django_db
    def test_service_update_audit_log(self, audit_log: AuditLog) -> None:
        """Test service update_log method."""
        updated = AuditLogService.update_log(
            audit_log, description="Updated description"
        )
        assert updated.description == "Updated description"
        assert AuditLog.objects.get(id=audit_log.id).description == (
            "Updated description"
        )

    @pytest.mark.django_db
    def test_service_delete_audit_log(self, audit_log: AuditLog) -> None:
        """Test service delete_log method."""
        AuditLogService.delete_log(audit_log)


class TestBackgroundJobService:
    """Tests for BackgroundJob inline job producer."""

    @pytest.mark.django_db
    def test_enqueue_and_run_success(self, organization) -> None:
        def _executor(value):
            return {"doubled": value * 2}

        job = BackgroundJobService.enqueue_and_run(
            job_type="export",
            organization_id=str(organization.id),
            description="Test export",
            executor=_executor,
            executor_kwargs={"value": 21},
        )

        assert job.status == BackgroundJob.STATUS_COMPLETED
        assert job.progress == 100
        assert job.started_at is not None
        assert job.completed_at is not None
        assert job.result_data == {"ok": True, "result": {"doubled": 42}}
        assert job.error_message == ""
        assert BackgroundJob.objects.filter(job_id=job.job_id).exists()

    @pytest.mark.django_db
    def test_enqueue_and_run_records_failure(self, organization) -> None:
        def _executor():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            BackgroundJobService.enqueue_and_run(
                job_type="export",
                organization_id=str(organization.id),
                description="Failing export",
                executor=_executor,
            )

        job = BackgroundJob.objects.filter(description="Failing export").latest("created_at")
        assert job.status == BackgroundJob.STATUS_FAILED
        assert job.error_message == "boom"

    @pytest.mark.django_db
    def test_enqueue_and_run_serializes_orm_result(self, organization) -> None:
        def _executor():
            return organization

        job = BackgroundJobService.enqueue_and_run(
            job_type="export",
            organization_id=str(organization.id),
            description="ORM result export",
            executor=_executor,
        )

        assert job.status == BackgroundJob.STATUS_COMPLETED
        assert job.result_data["result_id"] == str(organization.pk)
        assert job.result_data["result_type"] == type(organization).__name__
