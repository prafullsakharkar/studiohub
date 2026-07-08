from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.events import EventBus
from apps.identity.api_keys import APIKeyUtils


class TokenServiceMixin:
    """
    Shared service implementation for APIKey and PersonalAccessToken.
    """

    selector_class = None

    hash_field = None

    owner_field = None

    create_event = None

    activate_event = None

    revoke_event = None

    regenerate_event = None

    used_event = None

    @classmethod
    def get_owner(
        cls,
        instance,
    ):
        return getattr(
            instance,
            cls.owner_field,
        )

    @classmethod
    @transaction.atomic
    def create(
        cls,
        **validated_data,
    ):
        generated = APIKeyUtils.generate()

        validated_data[cls.hash_field] = generated["hashed"]
        validated_data["prefix"] = generated["prefix"]

        instance = cls.create_instance(
            **validated_data,
        )

        EventBus.publish(
            cls.create_event(
                actor=cls.get_owner(instance),
                instance=instance,
            ),
        )

        return instance, generated["token"]

    @classmethod
    def verify(
        cls,
        token,
    ):
        try:
            prefix, _ = token.split(
                ".",
                1,
            )
        except ValueError:
            return None

        instance = cls.selector_class.get_by_prefix(
            prefix,
        )

        if instance is None:
            return None

        if not instance.is_active:
            return None

        if instance.expired:
            return None

        if not APIKeyUtils.verify(
            token=token,
            hashed=getattr(
                instance,
                cls.hash_field,
            ),
        ):
            return None

        return instance

    @classmethod
    @transaction.atomic
    def touch(
        cls,
        instance,
        ip_address=None,
    ):
        instance.last_used_at = timezone.now()
        instance.last_used_ip = ip_address

        instance.save(
            update_fields=[
                "last_used_at",
                "last_used_ip",
            ],
        )

        EventBus.publish(
            cls.used_event(
                actor=cls.get_owner(instance),
                instance=instance,
            ),
        )

        return instance

    @classmethod
    @transaction.atomic
    def activate(
        cls,
        instance,
    ):
        instance = cls.update_instance(
            instance,
            is_active=True,
        )

        EventBus.publish(
            cls.activate_event(
                actor=cls.get_owner(instance),
                instance=instance,
            ),
        )

        return instance

    @classmethod
    @transaction.atomic
    def revoke(
        cls,
        instance,
    ):
        instance = cls.update_instance(
            instance,
            is_active=False,
        )

        EventBus.publish(
            cls.revoke_event(
                actor=cls.get_owner(instance),
                instance=instance,
            ),
        )

        return instance

    @classmethod
    @transaction.atomic
    def regenerate(
        cls,
        instance,
    ):
        generated = APIKeyUtils.generate()

        instance = cls.update_instance(
            instance,
            prefix=generated["prefix"],
            **{
                cls.hash_field: generated["hashed"],
            },
        )

        EventBus.publish(
            cls.regenerate_event(
                actor=cls.get_owner(instance),
                instance=instance,
            ),
        )

        return instance, generated["token"]
