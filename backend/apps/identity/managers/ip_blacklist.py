from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.ip_blacklist import (
    IPBlacklistQuerySet,
)


class IPBlacklistManager(
    BaseManager.from_queryset(IPBlacklistQuerySet),
):
    """Manager for IPBlacklist."""
