from apps.identity.models import TrustedDevice
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class TrustedDeviceSelector(IdentityBaseSelector):
    model = TrustedDevice

    @classmethod
    def get_user_devices(cls, user):
        return TrustedDevice.objects.active().by_user(user)

    @classmethod
    def get_by_fingerprint(cls, fingerprint):
        return TrustedDevice.objects.by_fingerprint(fingerprint).first()

    @classmethod
    def is_trusted(cls, user, fingerprint):
        return (
            TrustedDevice.objects.active()
            .by_user(user)
            .by_fingerprint(fingerprint)
            .exists()
        )

    @classmethod
    def get_revoked(cls, user):
        return TrustedDevice.objects.revoked().by_user(user)
