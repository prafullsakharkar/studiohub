"""
Business service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.events import EventBus
from apps.core.services.mixins.lifecycle import LifecycleMixin
from apps.core.services.mixins.soft_delete import SoftDeleteMixin

from .audit import AuditService


class BusinessService(
    LifecycleMixin,
    SoftDeleteMixin,
    AuditService,
):
    """
    Base class for all business services.
    """

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    model = None

    selector_class = None

    validator_class = None

    event_map = {}

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    ARCHIVE = "archive"
    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @classmethod
    def validate(
        cls,
        operation: str,
        **kwargs,
    ):
        if cls.validator_class is None:
            return

        validator = getattr(
            cls.validator_class,
            f"validate_{operation}",
            None,
        )

        if validator:
            validator(**kwargs)

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------

    @classmethod
    def publish_event(
        cls,
        operation: str,
        **kwargs,
    ):
        event = cls.event_map.get(operation)

        if event is not None:
            EventBus.publish(
                event(**kwargs),
            )

    # ------------------------------------------------------------------
    # Hooks
    # ------------------------------------------------------------------

    @classmethod
    def before_create(
        cls,
        **validated_data,
    ):
        return validated_data

    @classmethod
    def after_create(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def before_update(
        cls,
        instance,
        **validated_data,
    ):
        return instance, validated_data

    @classmethod
    def after_update(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def before_delete(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def after_delete(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def before_restore(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def after_restore(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def before_archive(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def after_archive(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def before_activate(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def after_activate(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def before_deactivate(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def after_deactivate(
        cls,
        instance,
        **kwargs,
    ):
        return instance

    @classmethod
    def invalidate_cache(
        cls,
        instance,
    ):
        """
        Override in subclasses.
        """
        return

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        cls.validate(
            cls.CREATE,
            **validated_data,
        )

        validated_data = cls.before_create(
            **validated_data,
        )

        instance = super().create(
            user=user,
            **validated_data,
        )

        instance = cls.after_create(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.CREATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def update(
        cls,
        instance,
        *,
        user=None,
        **validated_data,
    ):
        cls.validate(
            cls.UPDATE,
            instance=instance,
            **validated_data,
        )

        instance, validated_data = cls.before_update(
            instance,
            **validated_data,
        )

        instance = super().update(
            instance,
            user=user,
            **validated_data,
        )

        instance = cls.after_update(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.UPDATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def delete(
        cls,
        instance,
        *,
        user=None,
    ):
        cls.validate(
            cls.DELETE,
            instance=instance,
        )

        instance = cls.before_delete(
            instance,
            user=user,
        )

        super().delete(
            instance,
            user=user,
        )

        cls.after_delete(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.DELETE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

    @classmethod
    @transaction.atomic
    def restore(
        cls,
        instance,
        *,
        user=None,
    ):
        instance = cls.before_restore(
            instance,
            user=user,
        )

        instance = super().restore(
            instance,
            user=user,
        )

        instance = cls.after_restore(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.RESTORE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def archive(
        cls,
        instance,
        *,
        user=None,
    ):
        instance = cls.before_archive(
            instance,
            user=user,
        )

        instance = super().archive(
            instance,
            user=user,
        )

        instance = cls.after_archive(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.ARCHIVE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def activate(
        cls,
        instance,
        *,
        user=None,
    ):
        instance = cls.before_activate(
            instance,
            user=user,
        )

        instance = super().activate(
            instance,
            user=user,
        )

        instance = cls.after_activate(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.ACTIVATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def deactivate(
        cls,
        instance,
        *,
        user=None,
    ):
        instance = cls.before_deactivate(
            instance,
            user=user,
        )

        instance = super().deactivate(
            instance,
            user=user,
        )

        instance = cls.after_deactivate(
            instance,
            user=user,
        )

        cls.publish_event(
            cls.DEACTIVATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance
