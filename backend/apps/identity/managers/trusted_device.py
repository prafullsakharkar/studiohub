from apps.core.managers import BaseManager
from apps.identity.querysets.trusted_device import TrustedDeviceQuerySet


class TrustedDeviceManager(BaseManager.from_queryset(TrustedDeviceQuerySet)):
    """Manager for TrustedDevice."""
