from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.identity.authentication.device import TrustedDeviceService
from apps.identity.events.mfa import (
    TrustedDeviceRegistered,
    TrustedDeviceRevoked,
)

from .base import BaseMFAService


class MFATrustedDeviceService(BaseMFAService):
    """
    Trusted device management.
    """

    DEVICE_LIFETIME_DAYS = getattr(
        settings,
        "MFA_TRUSTED_DEVICE_DAYS",
        30,
    )

    @classmethod
    @transaction.atomic
    def register(
        cls,
        *,
        user,
        request,
        device_name: str | None = None,
    ):
        """
        Register current device as trusted.
        """

        fingerprint = TrustedDeviceService.build_fingerprint(
            request,
        )

        expires_at = timezone.now() + timedelta(
            days=cls.DEVICE_LIFETIME_DAYS,
        )

        device, _ = cls.TrustedDevice.objects.update_or_create(
            user=user,
            fingerprint=fingerprint.fingerprint,
            defaults={
                "device_name": device_name or fingerprint.browser,
                "browser": fingerprint.browser,
                "operating_system": fingerprint.operating_system,
                "ip_address": fingerprint.ip_address,
                "trusted": True,
                "revoked": False,
                "last_used_at": timezone.now(),
                "expires_at": expires_at,
            },
        )

        cls.publish(
            TrustedDeviceRegistered(
                user=user,
                device=device,
            )
        )

        return device

    @classmethod
    @transaction.atomic
    def revoke(
        cls,
        *,
        device,
    ):
        """
        Revoke trusted device.
        """

        cls.TrustedDeviceValidator.validate_trust(device)

        device.trusted = False
        device.revoked = True

        device.save(
            update_fields=[
                "trusted",
                "revoked",
            ]
        )

        cls.publish(
            TrustedDeviceRevoked(
                user=device.user,
                device=device,
            )
        )

        return device

    @classmethod
    @transaction.atomic
    def revoke_all(
        cls,
        *,
        user,
    ):
        """
        Revoke all trusted devices.
        """

        devices = cls.TrustedDevice.objects.filter(
            user=user,
            revoked=False,
        )

        for device in devices:
            cls.revoke(device=device)

    @classmethod
    def validate(
        cls,
        *,
        user,
        request,
    ) -> bool:
        """
        Validate trusted device.
        """

        token = request.COOKIES.get(
            TrustedDeviceService.COOKIE_NAME,
        )

        if not token:
            return False

        if not TrustedDeviceService.matches(
            token=token,
            request=request,
            user_id=user.pk,
        ):
            return False

        fingerprint = TrustedDeviceService.build_fingerprint(
            request,
        )

        device = cls.TrustedDeviceSelector.get_by_fingerprint(
            fingerprint.fingerprint,
        )

        if device is None:
            return False

        cls.TrustedDeviceValidator.validate_use(device)

        cls.touch(device=device)

        return True

    @classmethod
    def touch(
        cls,
        *,
        device,
    ):
        """
        Update last used timestamp.
        """

        device.last_used_at = timezone.now()

        device.save(
            update_fields=[
                "last_used_at",
            ]
        )

        return device

    @classmethod
    def create_cookie(
        cls,
        *,
        response,
        user,
        request,
    ):
        """
        Attach remember-device cookie.
        """

        fingerprint = TrustedDeviceService.build_fingerprint(
            request,
        )

        token = TrustedDeviceService.sign(
            fingerprint=fingerprint.fingerprint,
            user_id=user.pk,
        )

        response.set_cookie(
            TrustedDeviceService.COOKIE_NAME,
            token,
            **TrustedDeviceService.cookie_kwargs(),
        )

        return response

    @classmethod
    def clear_cookie(
        cls,
        *,
        response,
    ):
        """
        Remove remember-device cookie.
        """

        response.delete_cookie(
            TrustedDeviceService.COOKIE_NAME,
        )

        return response

    @classmethod
    def list(
        cls,
        *,
        user,
    ):
        """
        List active trusted devices.
        """

        return cls.TrustedDeviceSelector.get_user_devices(
            user,
        )

    @classmethod
    def count(
        cls,
        *,
        user,
    ) -> int:
        """
        Count active trusted devices.
        """

        return cls.list(
            user=user,
        ).count()
