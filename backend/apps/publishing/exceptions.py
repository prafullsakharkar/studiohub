"""Publishing domain errors (mapped to HTTP by the core exception handler)."""

from __future__ import annotations

from apps.core.api.exceptions.api import ConflictException, PermissionDeniedException


class InvalidTransition(ConflictException):
    """The move is not in the transition map, or someone else made it first (409, Q27)."""

    default_detail = "This status change is not allowed."
    default_code = "invalid_transition"


class PathAlreadyRegistered(ConflictException):
    """The path is registered with different content (409)."""

    default_detail = "This path is already registered with different content."
    default_code = "path_already_registered"


class TransitionNotPermitted(PermissionDeniedException):
    """The caller lacks the permission the move needs (403)."""

    default_detail = "You may not make this status change."
    default_code = "transition_not_permitted"
