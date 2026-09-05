from apps.identity.models import TrustedDevice
from apps.identity.selectors.base import (
    IdentityBaseSelector,
)


class TrustedDeviceSelector(IdentityBaseSelector):
    model = TrustedDevice

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ):
        queryset = TrustedDevice.objects.all()

        user = getattr(request, "user", None)

        if user is None or user.is_staff or user.is_superuser:
            return queryset

        if not getattr(user, "is_authenticated", False):
            return queryset.none()

        return queryset.filter(
            user=user,
        )

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
