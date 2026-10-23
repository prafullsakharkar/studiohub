from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.identity.authentication.recovery import RecoveryCodeService
from apps.identity.choices import SecurityEventType
from apps.identity.events.mfa import (
    BackupCodesGenerated,
    BackupCodeUsed,
)

from .base import BaseMFAService


class MFARecoveryService(BaseMFAService):
    """
    Recovery code management (DOM-MFA-06).

    Codes are stored hashed, expire, and are consumed atomically: the
    conditional ``UPDATE ... WHERE used = false`` decides the winner, so two
    concurrent requests with the same code cannot both succeed.
    """

    @classmethod
    @transaction.atomic
    def generate(
        cls,
        *,
        user,
        count: int | None = None,
        request=None,
    ) -> list[str]:
        """
        Replace the user's recovery codes with a fresh set.

        Returns the plaintext codes; this is the only time they exist.
        """

        count = count or int(cls.RECOVERY_CODE_COUNT)

        cls.BackupCode.objects.filter(
            user=user,
        ).delete()

        recovery_codes = RecoveryCodeService.generate(
            count=count,
        )

        expires_at = timezone.now() + timedelta(days=cls.RECOVERY_CODE_DAYS)

        cls.BackupCode.objects.bulk_create(
            [
                cls.BackupCode(
                    user=user,
                    code_hash=code.hashed,
                    expires_at=expires_at,
                )
                for code in recovery_codes
            ]
        )

        cls.audit(
            user=user,
            event_type=SecurityEventType.MFA_RECOVERY_CODES_REGENERATED,
            description="Recovery codes generated.",
            request=request,
            metadata={"count": count},
        )

        cls.publish(
            BackupCodesGenerated(
                user=user,
            )
        )

        return [code.raw for code in recovery_codes]

    @classmethod
    def regenerate(
        cls,
        *,
        user,
        request=None,
    ) -> list[str]:
        """
        Invalidate every existing code and issue a new set.
        """

        return cls.generate(user=user, request=request)

    @classmethod
    @transaction.atomic
    def revoke_all(
        cls,
        *,
        user,
    ):
        """
        Delete all recovery codes.
        """

        cls.BackupCode.objects.filter(
            user=user,
        ).delete()

    @classmethod
    @transaction.atomic
    def consume(
        cls,
        *,
        user,
        code: str,
        request=None,
    ) -> bool:
        """
        Consume one recovery code. Returns whether a code was spent.
        """

        code = RecoveryCodeService.normalize(code)

        if not code:
            return False

        for recovery in cls.BackupCodeSelector.get_available(
            user=user,
        ):
            if not RecoveryCodeService.verify(
                code=code,
                hashed_code=recovery.code_hash,
            ):
                continue

            # The row is spent only if nobody spent it first.
            spent = (
                cls.BackupCode.objects.available()
                .filter(pk=recovery.pk)
                .update(
                    used=True,
                    used_at=timezone.now(),
                )
            )

            if not spent:
                return False

            cls.audit(
                user=user,
                event_type=SecurityEventType.MFA_RECOVERY_CODE_USED,
                description="Recovery code used.",
                request=request,
                metadata={"remaining": cls.remaining(user=user)},
            )

            cls.publish(
                BackupCodeUsed(
                    user=user,
                    backup_code=recovery,
                )
            )

            return True

        return False

    @classmethod
    def remaining(
        cls,
        *,
        user,
    ) -> int:
        """
        Remaining usable recovery codes.
        """

        return cls.BackupCodeSelector.get_available(
            user=user,
        ).count()

    @classmethod
    def has_codes(
        cls,
        *,
        user,
    ) -> bool:
        return cls.remaining(user=user) > 0

    @classmethod
    def list(
        cls,
        *,
        user,
    ):
        return cls.BackupCodeSelector.get_available(
            user=user,
        )

    @classmethod
    def is_valid(
        cls,
        *,
        user,
        code: str,
    ) -> bool:
        """
        Check whether an unspent code exists, without spending it.
        """

        code = RecoveryCodeService.normalize(code)

        return bool(code) and any(
            RecoveryCodeService.verify(
                code=code,
                hashed_code=recovery.code_hash,
            )
            for recovery in cls.BackupCodeSelector.get_available(
                user=user,
            )
        )
