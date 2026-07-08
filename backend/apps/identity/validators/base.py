"""
Base validator for the Identity bounded context.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.core.validators.base import (
    BaseValidator,
)


class IdentityBaseValidator(BaseValidator):
    """
    Base validator for the Identity bounded context.
    """

    @classmethod
    def ensure(cls, condition, message):
        if not condition:
            raise ValidationError(message)

    @classmethod
    def ensure_not_none(cls, instance, message="Object not found."):
        cls.ensure(instance is not None, message)

    @classmethod
    def ensure_active(cls, instance):
        if hasattr(instance, "is_active"):
            cls.ensure(
                instance.is_active,
                "Object is inactive.",
            )

    @classmethod
    def ensure_not_deleted(cls, instance):
        if hasattr(instance, "deleted_at"):
            cls.ensure(
                instance.deleted_at is None,
                "Object has been deleted.",
            )

    @classmethod
    def validate(cls, *args, **kwargs):
        """
        Override in subclasses.
        """
        return
