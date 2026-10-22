from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

from apps.core.services.business import (
    BusinessService,
)
from apps.identity.events import (
    IPBlacklistActivated,
    IPBlacklistArchived,
    IPBlacklistCreated,
    IPBlacklistDeactivated,
    IPBlacklistDeleted,
    IPBlacklistRestored,
    IPBlacklistUpdated,
)
from apps.identity.models import (
    IPBlacklist,
)
from apps.identity.validators.ip_blacklist import (
    IPBlacklistValidator,
)


class IPBlacklistService(
    BusinessService,
):
    """
    Write operations for IPBlacklist.
    """

    model = IPBlacklist

    validator_class = IPBlacklistValidator

    event_map = {
        "create": IPBlacklistCreated,
        "update": IPBlacklistUpdated,
        "delete": IPBlacklistDeleted,
        "restore": IPBlacklistRestored,
        "archive": IPBlacklistArchived,
        "activate": IPBlacklistActivated,
        "deactivate": IPBlacklistDeactivated,
    }

    #: A block event is written at most once per address per window, so a
    #: blocked client hammering the login endpoint cannot flood the ledger.
    BLOCK_EVENT_WINDOW_SECONDS = 60

    @classmethod
    def record_block(
        cls,
        ip_address,
        *,
        user_agent="",
    ) -> bool:
        """
        Enforce the blacklist for one request and make the block observable.

        Returns True when an active entry (exact address or CIDR range)
        covers ``ip_address``. On a match every covering entry's
        ``hit_count`` / ``last_hit_at`` are advanced in one UPDATE and a
        rate-limited ``IP_BLOCKED`` security event is written best-effort.
        """

        entry_ids = list(
            IPBlacklist.objects.matching(ip_address).values_list("pk", flat=True),
        )

        if not entry_ids:
            return False

        IPBlacklist.objects.filter(pk__in=entry_ids).update(
            hit_count=F("hit_count") + 1,
            last_hit_at=timezone.now(),
        )

        if cache.add(
            f"identity.audit.ip_blocked:{ip_address}",
            1,
            cls.BLOCK_EVENT_WINDOW_SECONDS,
        ):
            from apps.identity.choices import SecurityEventType
            from apps.identity.services.security_event import (
                SecurityEventService,
            )

            SecurityEventService.emit(
                event_type=SecurityEventType.IP_BLOCKED,
                ip_address=ip_address,
                user_agent=user_agent,
                description="Login blocked: IP address is blacklisted.",
                metadata={"entry_ids": [str(pk) for pk in entry_ids]},
            )

        return True

    @classmethod
    def activate(
        cls,
        instance,
        *,
        user=None,
    ):
        """
        Activate a blacklist entry.

        ``IPBlacklist`` has no lifecycle ``status`` column, so the base
        ``LifecycleService.change_status`` flow is replaced with the
        ``is_active`` flag while keeping event publishing and cache
        invalidation.
        """

        instance.is_active = True

        instance.save(
            update_fields=[
                "is_active",
                "updated_at",
            ],
        )

        cls.publish_event(
            cls.ACTIVATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    def deactivate(
        cls,
        instance,
        *,
        user=None,
    ):
        """
        Deactivate a blacklist entry via the ``is_active`` flag.
        """

        instance.is_active = False

        instance.save(
            update_fields=[
                "is_active",
                "updated_at",
            ],
        )

        cls.publish_event(
            cls.DEACTIVATE,
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance


# ----------------------------------------------------------------------
# Module-level functional API (kept for compatibility)
# ----------------------------------------------------------------------


def create_ip_blacklist(user, data):
    """Create an IP blacklist entry."""
    return IPBlacklistService.create(
        user=user,
        **data,
    )


def update_ip_blacklist(entry, data):
    """Update an IP blacklist entry."""
    return IPBlacklistService.update(
        entry,
        **data,
    )


def delete_ip_blacklist(entry):
    """Delete an IP blacklist entry."""
    IPBlacklistService.delete(entry)
    return True


def is_ip_blacklisted(ip_address):
    """Check whether an IP address is blacklisted."""
    return IPBlacklist.objects.is_ip_blacklisted(ip_address)
