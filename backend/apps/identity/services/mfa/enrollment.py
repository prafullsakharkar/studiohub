from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from apps.identity.authentication.qr import QRCodeService
from apps.identity.authentication.totp import TOTPService
from apps.identity.choices.mfa import (
    MFAMethod,
    MFAStatus,
)
from apps.identity.events.mfa import (
    MFADisabled,
    MFAEnabled,
    MFAEnrollmentStarted,
)

from .base import BaseMFAService


class MFAEnrollmentService(BaseMFAService):
    """
    Handles MFA enrollment lifecycle.
    """

    @classmethod
    @BaseMFAService.transaction.atomic
    def enroll(
        cls,
        *,
        user,
        method: str = MFAMethod.TOTP,
    ):
        mfa, _ = cls.UserMFA.objects.get_or_create(
            user=user,
        )

        mfa.method = method
        mfa.secret = TOTPService.generate_secret()
        mfa.status = MFAStatus.PENDING
        mfa.enabled = False
        mfa.verified = False
        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.last_verified_at = None

        mfa.save()

        cls.publish(
            MFAEnrollmentStarted(
                user=user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    @BaseMFAService.transaction.atomic
    def activate(
        cls,
        *,
        user,
    ):
        mfa = cls.UserMFASelector.get_by_user(user)

        cls.UserMFAValidator.validate_enable(mfa)

        mfa.enabled = True
        mfa.verified = True
        mfa.status = MFAStatus.ACTIVE
        mfa.last_verified_at = timezone.now()

        mfa.save(
            update_fields=[
                "enabled",
                "verified",
                "status",
                "last_verified_at",
            ]
        )

        cls.publish(
            MFAEnabled(
                user=user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    @BaseMFAService.transaction.atomic
    def disable(
        cls,
        *,
        user,
    ):
        mfa = cls.UserMFASelector.get_by_user(user)

        cls.UserMFAValidator.validate_disable(mfa)

        mfa.enabled = False
        mfa.verified = False
        mfa.status = MFAStatus.DISABLED

        mfa.save(
            update_fields=[
                "enabled",
                "verified",
                "status",
            ]
        )

        cls.publish(
            MFADisabled(
                user=user,
                mfa=mfa,
            )
        )

        return mfa

    @classmethod
    @BaseMFAService.transaction.atomic
    def regenerate_secret(
        cls,
        *,
        user,
    ):
        mfa = cls.UserMFASelector.get_by_user(user)

        cls.UserMFAValidator.validate_disable(mfa)

        mfa.secret = TOTPService.generate_secret()
        mfa.verified = False
        mfa.enabled = False
        mfa.status = MFAStatus.PENDING

        mfa.save(
            update_fields=[
                "secret",
                "verified",
                "enabled",
                "status",
            ]
        )

        return mfa

    @classmethod
    def provisioning_uri(
        cls,
        *,
        user,
    ) -> str:
        mfa = cls.UserMFASelector.get_by_user(user)

        return TOTPService.provisioning_uri(
            secret=mfa.secret,
            email=user.email,
            issuer=getattr(
                settings,
                "MFA_ISSUER_NAME",
                "Atom VFX",
            ),
        )

    @classmethod
    def qr_code(
        cls,
        *,
        user,
    ) -> str:
        mfa = cls.UserMFASelector.get_by_user(user)

        return QRCodeService.data_uri(
            email=user.email,
            secret=mfa.secret,
            issuer=getattr(
                settings,
                "MFA_ISSUER_NAME",
                "Atom VFX",
            ),
        )

    @classmethod
    @BaseMFAService.transaction.atomic
    def reset(
        cls,
        *,
        user,
    ):
        mfa = cls.UserMFASelector.get_by_user(user)

        mfa.secret = TOTPService.generate_secret()
        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.enabled = False
        mfa.verified = False
        mfa.status = MFAStatus.PENDING
        mfa.last_verified_at = None

        mfa.save(
            update_fields=[
                "secret",
                "failed_attempts",
                "locked_until",
                "enabled",
                "verified",
                "status",
                "last_verified_at",
            ]
        )

        return mfa
