"""
Background Job service.
"""
from __future__ import annotations

from django.db import transaction

from apps.audit.models.background_job import BackgroundJob
from apps.audit.validators.background_job import BackgroundJobValidator

from .base import AuditBaseService


class BackgroundJobService(AuditBaseService):
    """
    Service for BackgroundJob.
    """
    
    model = BackgroundJob
    validator = BackgroundJobValidator
    
    @classmethod
    def enqueue_and_run(
        cls,
        *,
        job_type: str,
        organization_id: str,
        description: str,
        executor,
        executor_args=(),
        executor_kwargs=None,
    ) -> BackgroundJob:
        """
        Record a background job and run its executor inline.

        StudioHub runs without a broker/worker by default, so jobs are
        executed synchronously inside the request but still surfaced on
        the audit background-jobs page with a real queued→completed /
        queued→failed lifecycle. When a Celery worker is available this
        can be swapped for a deferred ``.delay()`` without changing the
        producer call sites.
        """
        import uuid as _uuid

        from django.utils import timezone

        from apps.audit.models.background_job import BackgroundJob

        job = cls.model.objects.create(
            job_type=job_type,
            status=BackgroundJob.STATUS_QUEUED,
            progress=0,
            description=description,
            organization_id=organization_id,
            job_id=_uuid.uuid4().hex,
        )

        try:
            job.status = BackgroundJob.STATUS_STARTED
            job.started_at = timezone.now()
            job.save(update_fields=["status", "started_at"])

            result = executor(*executor_args, **(executor_kwargs or {}))

            job.status = BackgroundJob.STATUS_COMPLETED
            job.progress = 100
            job.completed_at = timezone.now()
            job.result_data = cls._serialize_result(result)
            job.save(update_fields=["status", "progress", "completed_at", "result_data"])
        except Exception as exc:  # noqa: BLE001 - job must never break the caller
            job.status = BackgroundJob.STATUS_FAILED
            job.completed_at = timezone.now()
            job.error_message = str(exc)[:2000]
            job.save(update_fields=["status", "completed_at", "error_message"])
            raise

        return job

    @staticmethod
    def _serialize_result(result) -> dict:
        """Return a JSON-safe summary of a job result (ORM objects → pk/str)."""
        import json

        if result is None:
            return {"ok": True}
        try:
            json.dumps(result)
            return {"ok": True, "result": result}
        except TypeError:
            obj_id = str(getattr(result, "pk", getattr(result, "id", "")))
            return {"ok": True, "result_id": obj_id, "result_type": type(result).__name__}

    @classmethod
    @transaction.atomic
    def create_job(cls, **validated_data) -> BackgroundJob:
        """
        Create a new background job log.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_job(cls, instance: BackgroundJob, **validated_data) -> BackgroundJob:
        """
        Update a background job log.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_job(cls, instance: BackgroundJob) -> None:
        """
        Delete a background job log.
        """
        instance.delete()

    @classmethod
    @transaction.atomic
    def retry_job(cls, instance: BackgroundJob) -> BackgroundJob:
        """Re-queue a job: reset progress so workers pick it up again."""
        cls.model.objects.filter(pk=instance.pk).update(
            status=BackgroundJob.STATUS_QUEUED,
            progress=0,
            started_at=None,
            completed_at=None,
            error_message="",
        )
        instance.refresh_from_db()
        return instance

    @classmethod
    @transaction.atomic
    def cancel_job(cls, instance: BackgroundJob) -> BackgroundJob:
        """Cancel a job: terminal cancelled state with completion stamp."""
        from django.utils import timezone

        cls.model.objects.filter(pk=instance.pk).update(
            status=BackgroundJob.STATUS_CANCELLED,
            completed_at=timezone.now(),
        )
        instance.refresh_from_db()
        return instance
