from __future__ import annotations

from django.conf import settings

from apps.identity.authentication.qr import QRCodeService
from apps.identity.authentication.totp import TOTPService


class MFAUtilityService:
    """
    Shared MFA helper methods.
    """

    @classmethod
    def generate_secret(cls) -> str:
        return TOTPService.generate_secret()

    @classmethod
    def provisioning_uri(
        cls,
        *,
        email: str,
        secret: str,
    ) -> str:
        return TOTPService.provisioning_uri(
            secret=secret,
            email=email,
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
        email: str,
        secret: str,
    ) -> str:
        return QRCodeService.data_uri(
            email=email,
            secret=secret,
            issuer=getattr(
                settings,
                "MFA_ISSUER_NAME",
                "Atom VFX",
            ),
        )

    @classmethod
    def current_code(
        cls,
        *,
        secret: str,
    ) -> str:
        return TOTPService.current_code(secret)

    @classmethod
    def verify(
        cls,
        *,
        secret: str,
        code: str,
    ) -> bool:
        return TOTPService.verify(
            secret=secret,
            code=code,
        )
