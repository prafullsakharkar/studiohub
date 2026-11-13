"""
Review media events (docs/review-pipeline RP-6, C-RP-24).

Published by ``ReviewMediaService`` (worker side) and dispatched after commit by the core event
bus. Payloads carry ids, the status and the failure code only. The in-app notifications of RP-6
subscribe.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class ReviewMediaFinished(DomainEvent):
    """
    A review media row reached ``ready`` or ``failed``.

    Payload: ``review_media_id``, ``version_id``, ``project_id``, ``status`` (``ready`` or
    ``failed``), ``error_code`` (``""`` when ready), ``created_by_id`` (or ``None``).
    """
