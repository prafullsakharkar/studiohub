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
