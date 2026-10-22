from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.identity.authentication.device import DeviceTokenService
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
    def _audit(cls, *, user, event, device):
        """Best-effort security event; never fails the device operation."""
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        SecurityEventService.emit(
            user=user,
            event_type=getattr(SecurityEventType, event),
            description=event.replace("_", " ").capitalize() + ".",
            metadata={"device_id": str(device.pk)},
        )

    @classmethod
    @transaction.atomic
    def register(
        cls,
        *,
        user,
        request,
    ):
        """
        Register current device as trusted for ``user``.

        Trust is minted here, server-side, after the caller has verified an
        MFA challenge; it is never accepted from client input. Re-registering
        a revoked device renews it (a fresh, explicit grant).
        """

        fingerprint = DeviceTokenService.build_fingerprint(
            request,
        )

        expires_at = timezone.now() + timedelta(
            days=cls.DEVICE_LIFETIME_DAYS,
        )

        device, _ = cls.TrustedDevice.objects.update_or_create(
            user=user,
            fingerprint=fingerprint.fingerprint,
            defaults={
                "browser": fingerprint.browser,
                "platform": fingerprint.operating_system,
                "ip_address": fingerprint.ip_address,
                "user_agent": fingerprint.user_agent,
                "is_trusted": True,
                "revoked_at": None,
                "last_login_at": timezone.now(),
                "expires_at": expires_at,
            },
        )

        cls._audit(
            user=user,
            event="TRUSTED_DEVICE_ADDED",
            device=device,
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

        device.is_trusted = False
        device.revoked_at = timezone.now()

        device.save(
            update_fields=[
                "is_trusted",
                "revoked_at",
                "updated_at",
            ]
        )

        cls._audit(
            user=device.user,
            event="TRUSTED_DEVICE_REMOVED",
            device=device,
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
            revoked_at__isnull=True,
        )

        for device in devices:
            cls.revoke(device=device)

        return len(devices)

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
            DeviceTokenService.COOKIE_NAME,
        )

        if not token:
            return False

        if not DeviceTokenService.matches(
            token=token,
            request=request,
            user_id=user.pk,
        ):
            return False

        fingerprint = DeviceTokenService.build_fingerprint(
            request,
        )

        # Owner-scoped: a device row belonging to anyone else never counts,
        # even if its fingerprint matches (DOM-DEV-01).
        device = (
            cls.TrustedDevice.objects.filter(
                user=user,
                fingerprint=fingerprint.fingerprint,
            )
            .select_related("user")
            .first()
        )

        if device is None or not device.is_trusted:
            return False

        # Revoked or expired devices fail closed instead of raising.
        try:
            cls.TrustedDeviceValidator.validate_use(device)
        except ValidationError:
            return False

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

        device.last_login_at = timezone.now()

        device.save(
            update_fields=[
                "last_login_at",
                "updated_at",
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

        fingerprint = DeviceTokenService.build_fingerprint(
            request,
        )

        token = DeviceTokenService.sign(
            fingerprint=fingerprint.fingerprint,
            user_id=user.pk,
        )

        response.set_cookie(
            DeviceTokenService.COOKIE_NAME,
            token,
            **DeviceTokenService.cookie_kwargs(),
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
            DeviceTokenService.COOKIE_NAME,
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
