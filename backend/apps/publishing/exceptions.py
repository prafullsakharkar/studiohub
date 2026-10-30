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


class JobNotEditable(ConflictException):
    """The export job is past the point where its details can be edited (409)."""

    default_detail = "This export job can no longer be edited."
    default_code = "job_not_editable"


class JobHasFiles(ConflictException):
    """Registered files refer to this export job, so it is part of their record and stays (409, CR-23)."""

    default_detail = "Registered files were produced by this export job, so it cannot be deleted."
    default_code = "job_has_files"
