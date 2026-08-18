from apps.core.models.managers.base import BaseManager

from apps.identity.querysets.security_event import (
    SecurityEventQuerySet,
)


class SecurityEventManager(
    BaseManager.from_queryset(SecurityEventQuerySet),
):
    """Manager for SecurityEvent."""
