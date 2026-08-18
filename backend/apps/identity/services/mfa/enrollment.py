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

        mfa.primary_method = method
        mfa.totp_secret = TOTPService.generate_secret()
        mfa.status = MFAStatus.DISABLED
        mfa.is_verified = False
        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.totp_confirmed_at = None

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

        mfa.status = MFAStatus.ENABLED
        mfa.is_verified = True
        mfa.totp_confirmed_at = timezone.now()

        mfa.save(
            update_fields=[
                "status",
                "is_verified",
                "totp_confirmed_at",
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

        mfa.status = MFAStatus.DISABLED
        mfa.is_verified = False

        mfa.save(
            update_fields=[
                "status",
                "is_verified",
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

        mfa.totp_secret = TOTPService.generate_secret()
        mfa.is_verified = False
        mfa.status = MFAStatus.DISABLED

        mfa.save(
            update_fields=[
                "totp_secret",
                "is_verified",
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
            secret=mfa.totp_secret,
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
            secret=mfa.totp_secret,
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

        mfa.totp_secret = TOTPService.generate_secret()
        mfa.failed_attempts = 0
        mfa.locked_until = None
        mfa.status = MFAStatus.DISABLED
        mfa.is_verified = False
        mfa.totp_confirmed_at = None

        mfa.save(
            update_fields=[
                "totp_secret",
                "failed_attempts",
                "locked_until",
                "status",
                "is_verified",
                "totp_confirmed_at",
            ]
        )

        return mfa
