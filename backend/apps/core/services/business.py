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

    validator_class = None

    event_map = {}

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @classmethod
    def validate(
        cls,
        operation: str,
        **kwargs,
    ):
        """
        Execute operation specific validator.
        """
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
        """
        Publish configured event.
        """
        event = cls.event_map.get(operation)

        if event:
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
    def invalidate_cache(cls, instance):
        """
        Override in subclasses if required.
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
            "create",
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
            "create",
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
            "update",
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
            "update",
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance
