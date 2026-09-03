"""
Tag services.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction

from apps.core.services.base import BaseService
from apps.core.validators.tag import TagValidator

if TYPE_CHECKING:
    from apps.core.models.tag import Tag


class TagService(BaseService):
    """
    Service for Tag operations.
    """

    model = None  # Will be set by subclasses or registered dynamically
    validator_class = TagValidator

    @classmethod
    @transaction.atomic
    def create_instance(cls, **validated_data) -> Tag:
        """Create a tag instance."""
        cls.validator_class.validate_create(**validated_data)
        from apps.core.models.tag import Tag

        instance = Tag.objects.create(**validated_data)
        return instance

    @classmethod
    @transaction.atomic
    def update_instance(cls, instance: Tag, **validated_data) -> Tag:
        """Update a tag instance."""
        cls.validator_class.validate_update(instance, **validated_data)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    @classmethod
    @transaction.atomic
    def delete_instance(cls, instance: Tag) -> None:
        """Delete a tag instance."""
        cls.validator_class.validate_delete(instance)
        instance.delete()

    @classmethod
    @transaction.atomic
    def archive_instance(cls, instance: Tag) -> Tag:
        """Archive a tag instance."""
        cls.validator_class.validate_archive(instance)
        instance.archive()
        return instance

    @classmethod
    @transaction.atomic
    def restore_instance(cls, instance: Tag) -> Tag:
        """Restore an archived tag instance."""
        cls.validator_class.validate_activate(instance)
        instance.restore()
        return instance
