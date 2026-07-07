from __future__ import annotations

import base64
from io import BytesIO

import qrcode
from django.conf import settings

from .totp import TOTPService


class QRCodeService:
    """
    QR Code utilities for MFA enrollment.

    Generates QR images compatible with:

    - Google Authenticator
    - Microsoft Authenticator
    - Authy
    - Bitwarden
    - 1Password
    """

    DEFAULT_BOX_SIZE = 8
    DEFAULT_BORDER = 2

    @classmethod
    def provisioning_uri(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> str:
        """
        Returns otpauth:// URI.
        """

        issuer = issuer or getattr(
            settings,
            "MFA_ISSUER_NAME",
            "Enterprise",
        )

        return TOTPService.provisioning_uri(
            secret=secret,
            email=email,
            issuer=issuer,
        )

    @classmethod
    def build_image(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ):
        """
        Returns PIL Image.
        """

        uri = cls.provisioning_uri(
            email=email,
            secret=secret,
            issuer=issuer,
        )

        qr = qrcode.QRCode(
            version=1,
            box_size=cls.DEFAULT_BOX_SIZE,
            border=cls.DEFAULT_BORDER,
        )

        qr.add_data(uri)
        qr.make(fit=True)

        return qr.make_image(
            fill_color="black",
            back_color="white",
        )

    @classmethod
    def png_bytes(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> bytes:
        """
        Returns PNG bytes.
        """

        image = cls.build_image(
            email=email,
            secret=secret,
            issuer=issuer,
        )

        buffer = BytesIO()

        image.save(
            buffer,
            format="PNG",
        )

        return buffer.getvalue()

    @classmethod
    def base64(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> str:
        """
        Returns Base64 encoded PNG.
        """

        return base64.b64encode(
            cls.png_bytes(
                email=email,
                secret=secret,
                issuer=issuer,
            )
        ).decode()

    @classmethod
    def data_uri(
        cls,
        *,
        email: str,
        secret: str,
        issuer: str | None = None,
    ) -> str:
        """
        Returns browser-ready image.

        data:image/png;base64,...
        """

        return "data:image/png;base64," + cls.base64(
            email=email,
            secret=secret,
            issuer=issuer,
        )

    @classmethod
    def save(
        cls,
        *,
        email: str,
        secret: str,
        path: str,
        issuer: str | None = None,
    ) -> str:
        """
        Save QR image to disk.
        """

        image = cls.build_image(
            email=email,
            secret=secret,
            issuer=issuer,
        )

        image.save(path)

        return path
