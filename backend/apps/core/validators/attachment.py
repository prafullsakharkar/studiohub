"""
Attachment validators.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.core.models.attachment import Attachment

__all__ = ["AttachmentValidator"]


class AttachmentValidator:
    """Validator for Attachment models."""

    @staticmethod
    def validate(**data: Any) -> None:
        """Validate data."""
        pass

    @staticmethod
    def validate_create(**data: Any) -> None:
        """Validate data for creation."""
        pass

    @staticmethod
    def validate_update(instance: Attachment, **data: Any) -> None:
        """Validate data for update."""
        pass

    @staticmethod
    def validate_delete(instance: Attachment) -> None:
        """Validate deletion."""
        pass

    @staticmethod
    def validate_activate(instance: Attachment) -> None:
        """Validate activation."""
        pass

    @staticmethod
    def validate_deactivate(instance: Attachment) -> None:
        """Validate deactivation."""
        pass

    @staticmethod
    def validate_archive(instance: Attachment) -> None:
        """Validate archiving."""
        pass
