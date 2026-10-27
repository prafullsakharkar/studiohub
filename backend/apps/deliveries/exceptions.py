"""Delivery domain errors (mapped to HTTP by the core exception handler)."""

from __future__ import annotations

from rest_framework.exceptions import ValidationError

from apps.core.api.exceptions.api import ConflictException


class InvalidTransition(ConflictException):
    """The delivery is not in a status this action works from, or someone else got there first (409)."""

    default_detail = "This action is not allowed in the delivery's current status."
    default_code = "invalid_transition"


class DeliveryNotEditable(ConflictException):
    """The delivery has been sent (or is past the point where it can change) (409)."""

    default_detail = "This delivery can no longer be edited."
    default_code = "delivery_not_editable"


class QCFailed(ConflictException):
    """The delivery did not pass QC; the failing checks are in the body (409)."""

    default_detail = "The delivery did not pass QC."
    default_code = "qc_failed"


class UndeliverableVersion(ValidationError):
    """The version cannot be added: ``reason`` says why (400)."""

    UNKNOWN = "unknown_version"
    NOT_PUBLISHED = "not_published"
    NO_FILES = "no_registered_files"
    CHECKSUM = "checksum_problem"

    def __init__(self, reason: str) -> None:
        super().__init__({"version_id": ["Unknown or undeliverable version."], "reason": [reason]})
        self.reason = reason
