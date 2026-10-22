import logging

from django.db import transaction

from apps.identity.models import SecurityEvent

logger = logging.getLogger(__name__)


class SecurityEventService:
    """
    Write operations for SecurityEvent.
    """

    model = SecurityEvent

    @classmethod
    def emit(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        """
        Best-effort write for events that must never fail the operation that
        produced them (SEC-AUD-02): login, refresh, session creation.

        The insert runs in its own savepoint so a database error cannot
        poison the caller's transaction; failures are logged and swallowed.
        Use ``create`` when the event is part of the operation itself.
        """

        try:
            with transaction.atomic():
                return cls.create(user=user, **validated_data)
        except Exception:  # noqa: BLE001 - audit must not break the caller
            logger.exception(
                "security_event_emit_failed",
                extra={"event_type": str(validated_data.get("event_type"))},
            )
            return None

    @classmethod
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        return SecurityEvent.objects.create(
            user=user,
            **validated_data,
        )

    @classmethod
    def update(
        cls,
        instance,
        **validated_data,
    ):
        for key, value in validated_data.items():
            setattr(
                instance,
                key,
                value,
            )

        instance.save()

        return instance

    @classmethod
    def delete(
        cls,
        instance,
        **kwargs,
    ):
        instance.delete()
