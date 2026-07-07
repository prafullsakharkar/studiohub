from __future__ import annotations

from apps.identity.authentication.qr import QRCodeService
from apps.identity.authentication.recovery import RecoveryCodeService
from apps.identity.authentication.totp import TOTPService

from .base import BaseMFAService


class MFAGeneratorService(BaseMFAService):
    """
    MFA generation utilities.
    """

    @classmethod
    def generate_secret(cls) -> str:
        return TOTPService.generate_secret()

    @classmethod
    def generate_totp(
        cls,
        *,
        secret: str,
    ) -> str:
        return TOTPService.current_code(secret)

    @classmethod
    def verify_totp(
        cls,
        *,
        secret: str,
        code: str,
    ) -> bool:
        return TOTPService.verify(
            secret=secret,
            code=code,
        )

    @classmethod
    def provisioning_uri(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> str:
        return TOTPService.provisioning_uri(
            secret=secret,
            email=email,
            issuer=issuer or cls.ISSUER,
        )

    @classmethod
    def qr_code(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> str:
        return QRCodeService.data_uri(
            email=email,
            secret=secret,
            issuer=issuer or cls.ISSUER,
        )

    @classmethod
    def qr_png(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> bytes:
        return QRCodeService.png_bytes(
            email=email,
            secret=secret,
            issuer=issuer or cls.ISSUER,
        )

    @classmethod
    def generate_recovery_codes(
        cls,
        *,
        count: int | None = None,
    ):
        return RecoveryCodeService.generate(
            count=count or cls.RECOVERY_CODE_COUNT,
        )

    @classmethod
    def hash_recovery_code(
        cls,
        code: str,
    ) -> str:
        return RecoveryCodeService.hash(code)

    @classmethod
    def verify_recovery_code(
        cls,
        *,
        code: str,
        hashed_code: str,
    ) -> bool:
        return RecoveryCodeService.verify(
            code=code,
            hashed_code=hashed_code,
        )

    @classmethod
    def find_matching_recovery_code(
        cls,
        *,
        code: str,
        hashes,
    ):
        return RecoveryCodeService.find_matching(
            code=code,
            hashes=hashes,
        )
