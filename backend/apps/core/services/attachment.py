"""
Attachment services.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.core.services.base import BaseService
from apps.core.validators.attachment import AttachmentValidator

if TYPE_CHECKING:
    from apps.core.models.attachment import Attachment


class AttachmentService(BaseService):
    """
    Service for Attachment operations.
    """

    model = None  # Will be set by subclasses or registered dynamically
    validator_class = AttachmentValidator

    @classmethod
    @transaction.atomic
    def create_instance(cls, **validated_data) -> "Attachment":
        """Create an attachment instance."""
        cls.validator_class.validate_create(**validated_data)
        from apps.core.models.attachment import Attachment

        instance = Attachment.objects.create(**validated_data)
        return instance

    @classmethod
    @transaction.atomic
    def update_instance(cls, instance: "Attachment", **validated_data) -> "Attachment":
        """Update an attachment instance."""
        cls.validator_class.validate_update(instance, **validated_data)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    @classmethod
    @transaction.atomic
    def delete_instance(cls, instance: "Attachment") -> None:
        """Delete an attachment instance."""
        cls.validator_class.validate_delete(instance)
        instance.delete()

    @classmethod
    @transaction.atomic
    def archive_instance(cls, instance: "Attachment") -> "Attachment":
        """Archive an attachment instance."""
        cls.validator_class.validate_archive(instance)
        instance.archive()
        return instance

    @classmethod
    @transaction.atomic
    def restore_instance(cls, instance: "Attachment") -> "Attachment":
        """Restore an archived attachment instance."""
        cls.validator_class.validate_activate(instance)
        instance.restore()
        return instance
