"""
Review events (docs/review-pipeline RP-11 WP 11.2).

Published by ``ReviewService`` and dispatched after commit by the core event bus. Payloads carry ids,
status names and flags only, never a comment's text. The in-app notifications subscribe (C-RP-28).
A decision that moves the review's status is ``StatusChanged`` (``entity_type = "Review"``);
``ReviewDecided`` covers the supervisor's verdict that leaves the status where it was.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class ReviewDecided(DomainEvent):
    """
    The supervisor recorded a decision without a status move (``Rejected`` or ``Changes Requested``
    by the verdict action, or the decision the review already had).

    Payload: ``review_id``, ``project_id``, ``decision``, ``actor_id``.
    """


class ReviewParticipantAdded(DomainEvent):
    """
    Someone was asked for a verdict.

    Payload: ``review_id``, ``project_id``, ``user_id``, ``actor_id``.
    """


class ReviewParticipantVerdict(DomainEvent):
    """
    A participant recorded a verdict.

    Payload: ``review_id``, ``project_id``, ``participant_user_id`` (``None`` for a row with no
    account), ``verdict``, ``actor_id``.
    """


class ReviewCommentAdded(DomainEvent):
    """
    A comment or a reply was added to a review.

    Payload: ``review_id``, ``project_id``, ``comment_id``, ``parent_id`` (``None`` for a first
    comment), ``version_id`` (``None`` when on no version), ``is_client_visible``, ``author_id``.
    """
