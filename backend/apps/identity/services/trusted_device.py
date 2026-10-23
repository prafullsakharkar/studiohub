from apps.identity.models import TrustedDevice


class TrustedDeviceService:
    """
    Write operations for TrustedDevice exposed to the API.

    The only client-driven write is revocation. Granting trust belongs to the
    MFA flow (``MFATrustedDeviceService.register``), after a verified
    challenge.
    """

    model = TrustedDevice

    @classmethod
    def revoke(
        cls,
        instance,
        *,
        actor=None,
    ):
        from apps.identity.services.mfa import MFATrustedDeviceService

        if instance.revoked_at is not None:
            return instance

        return MFATrustedDeviceService.revoke(device=instance)
