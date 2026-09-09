"""
Tag validators.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.core.models.tag import Tag

__all__ = ["TagValidator"]


class TagValidator:
    """Validator for Tag models."""

    @staticmethod
    def validate(**data: Any) -> None:
        """Validate data."""
        pass

    @staticmethod
    def validate_create(**data: Any) -> None:
        """Validate data for creation."""
        pass

    @staticmethod
    def validate_update(instance: Tag, **data: Any) -> None:
        """Validate data for update."""
        pass

    @staticmethod
    def validate_delete(instance: Tag) -> None:
        """Validate deletion."""
        pass

    @staticmethod
    def validate_activate(instance: Tag) -> None:
        """Validate activation."""
        pass

    @staticmethod
    def validate_deactivate(instance: Tag) -> None:
        """Validate deactivation."""
        pass

    @staticmethod
    def validate_archive(instance: Tag) -> None:
        """Validate archiving."""
        pass
