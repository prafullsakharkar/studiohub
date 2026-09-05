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
