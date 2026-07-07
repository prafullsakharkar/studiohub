from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.identity.authentication.recovery import RecoveryCodeService
from apps.identity.events.mfa import (
    BackupCodesGenerated,
    BackupCodeUsed,
)

from .base import BaseMFAService


class MFARecoveryService(BaseMFAService):
    """
    Recovery code management.
    """

    @classmethod
    @transaction.atomic
    def generate(
        cls,
        *,
        user,
        count: int | None = None,
    ) -> list[str]:
        """
        Generate recovery codes.

        Returns plaintext codes exactly once.
        """

        count = count or cls.RECOVERY_CODES

        cls.BackupCode.objects.filter(
            user=user,
        ).delete()

        recovery_codes = RecoveryCodeService.generate(
            count=count,
        )

        cls.BackupCode.objects.bulk_create(
            [
                cls.BackupCode(
                    user=user,
                    code_hash=code.hashed,
                )
                for code in recovery_codes
            ]
        )

        cls.publish(
            BackupCodesGenerated(
                user=user,
            )
        )

        return [code.raw for code in recovery_codes]

    @classmethod
    @transaction.atomic
    def regenerate(
        cls,
        *,
        user,
    ) -> list[str]:
        """
        Delete existing recovery codes and generate new ones.
        """

        cls.revoke_all(user=user)

        return cls.generate(user=user)

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
    ) -> bool:
        """
        Consume a recovery code.
        """

        recovery_codes = cls.BackupCodeSelector.get_available(
            user=user,
        )

        for recovery in recovery_codes:

            if RecoveryCodeService.verify(
                code=code,
                hashed_code=recovery.code_hash,
            ):
                recovery.used = True
                recovery.used_at = timezone.now()

                recovery.save(
                    update_fields=[
                        "used",
                        "used_at",
                    ]
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
        Remaining recovery codes.
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
        """
        Check whether user still has recovery codes.
        """

        return (
            cls.remaining(
                user=user,
            )
            > 0
        )

    @classmethod
    def list(
        cls,
        *,
        user,
    ):
        """
        List recovery code objects.
        """

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
        Check whether a recovery code exists.
        """

        for recovery in cls.BackupCodeSelector.get_available(
            user=user,
        ):
            if RecoveryCodeService.verify(
                code=code,
                hashed_code=recovery.code_hash,
            ):
                return True

        return False
