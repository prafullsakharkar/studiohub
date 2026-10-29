"""Delivery domain errors (mapped to HTTP by the core exception handler)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from apps.core.api.exceptions.api import ConflictException, PermissionDeniedException


class TransitionNotPermitted(PermissionDeniedException):
    """The caller lacks the permission the status change needs (403)."""

    default_detail = "You may not make this status change."
    default_code = "transition_not_permitted"


class SeparationOfDuties(PermissionDeniedException):
    """The caller prepared this delivery and so cannot sign it off (403, SEC-DLV-03)."""

    default_detail = "You prepared this delivery, so someone else must sign it off."
    default_code = "separation_of_duties"


class SecretStorageUnavailable(APIException):
    """The passcode cannot be encrypted or decrypted right now: no usable key (503)."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Delivery passcodes are temporarily unavailable."
    default_code = "secret_storage_unavailable"


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
