from django.utils import timezone

from apps.core.validators import BaseValidator
from apps.identity.models import TrustedDevice


class TrustedDeviceValidator(BaseValidator):
    model = TrustedDevice

    @classmethod
    def validate_trust(cls, device: TrustedDevice):
        cls.check_not_none(device, "Device not found.")

        if device.revoked:
            cls.raise_validation_error("Device has been revoked.")

    @classmethod
    def validate_use(cls, device: TrustedDevice):
        cls.check_not_none(device, "Device not found.")

        if device.revoked:
            cls.raise_validation_error("Device has been revoked.")

        if device.expires_at and device.expires_at <= timezone.now():
            cls.raise_validation_error("Trusted device has expired.")
