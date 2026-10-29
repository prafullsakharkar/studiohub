"""Production domain errors (mapped to HTTP by the core exception handler)."""

from __future__ import annotations

from apps.core.api.exceptions.api import (
    ConflictException,
    PermissionDeniedException,
    ValidationException,
)


class InvalidTransition(ValidationException):
    """The status is unknown for the entity or may not follow the current one (400)."""

    default_detail = "Invalid status transition."
    default_code = "invalid_transition"


class TransitionNotPermitted(PermissionDeniedException):
    """The caller lacks the permission the transition needs (403)."""

    default_detail = "You may not make this status change."
    default_code = "transition_not_permitted"


class SeparationOfDuties(PermissionDeniedException):
    """The caller produced the work they are asked to approve (403)."""

    default_detail = "You cannot approve work you produced."
    default_code = "separation_of_duties"


class StatusConflict(ConflictException):
    """The record already has the requested status; someone else got there first (409)."""

    default_detail = "The record already has this status."
    default_code = "status_conflict"
