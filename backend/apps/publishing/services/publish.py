"""
Entry points the export job endpoints call (the status rules live in ``services.workflow``).

They keep the call shape the viewset and ``BackgroundJobService`` already use (``publish_id``,
``user_id``) and hand over to ``JobService``. Nothing here writes a status.
"""

from __future__ import annotations

from typing import Any

from apps.publishing.models import PublishItem
from apps.publishing.services.workflow import JobService


def _actor(user_id: str | None):
    if not user_id:
        return None
    from django.contrib.auth import get_user_model

    return get_user_model().objects.filter(pk=user_id).first()


def validate_publish(*, publish_id: str, user_id: str | None) -> dict[str, Any]:
    """Run validation on an export job. The reply keeps its old keys and adds the per-rule statuses."""
    job, summary = JobService.validate(actor=_actor(user_id), job=publish_id)
    return {
        "success": True,
        "publish_id": str(job.pk),
        "status": job.status,
        "validation_results": summary["results"],
        "all_passed": summary["passed"],
        "counts": summary["counts"],
        "checked_at": summary["checked_at"],
    }


def republish(*, publish_id: str, user_id: str | None, comment: str = "") -> PublishItem:
    """A new Pending job from one that has run its course."""
    return JobService.republish(actor=_actor(user_id), job=publish_id, comment=comment)


def unpublish(*, publish_id: str, user_id: str | None, reason: str = "") -> PublishItem:
    """Cancel an export job that has not finished."""
    return JobService.cancel(actor=_actor(user_id), job=publish_id, reason=reason)


def retry_publish(*, publish_id: str, user_id: str | None) -> PublishItem:
    """Send a Failed export job back to Pending."""
    return JobService.retry(actor=_actor(user_id), job=publish_id)
