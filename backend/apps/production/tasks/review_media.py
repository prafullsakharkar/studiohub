"""
Review media jobs (review-pipeline RP-5, ADR-0040).

``production.process_review_media`` is routed to the ``media`` queue (``CELERY_TASK_ROUTES``), which
only the ``celery-media`` worker consumes: it is the one container with ffmpeg and the media volume.
``production.sweep_review_media`` runs from beat on the default queue and only updates rows.
"""

from __future__ import annotations

from celery import shared_task

from apps.production.services.review_media import PROCESS_TASK, ReviewMediaService


@shared_task(
    name=PROCESS_TASK,
    acks_late=True,
    soft_time_limit=27 * 60,
    time_limit=30 * 60,
    ignore_result=True,
)
def process_review_media(media_id: str) -> str | None:
    return ReviewMediaService.process(media_id)


@shared_task(name="production.sweep_review_media", ignore_result=True)
def sweep_review_media() -> int:
    return ReviewMediaService.sweep()
