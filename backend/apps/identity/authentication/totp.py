from __future__ import annotations

from typing import Optional

import pyotp


class TOTPService:
    """
    Enterprise TOTP helper.

    RFC6238 compliant.
    Compatible with:

    - Google Authenticator
    - Microsoft Authenticator
    - Authy
    - 1Password
    - Bitwarden
    """

    DEFAULT_INTERVAL = 30
    DEFAULT_DIGITS = 6
    DEFAULT_WINDOW = 1

    @classmethod
    def generate_secret(cls) -> str:
        """
        Generates a Base32 secret.

        Example:
        JBSWY3DPEHPK3PXP
        """
        return pyotp.random_base32()

    @classmethod
    def build_totp(
        cls,
        secret: str,
        *,
        interval: int = DEFAULT_INTERVAL,
        digits: int = DEFAULT_DIGITS,
    ) -> pyotp.TOTP:
        return pyotp.TOTP(
            s=secret,
            interval=interval,
            digits=digits,
        )

    @classmethod
    def current_code(
        cls,
        secret: str,
    ) -> str:
        return cls.build_totp(secret).now()

    @classmethod
    def verify(
        cls,
        *,
        secret: str,
        code: str,
        valid_window: int = DEFAULT_WINDOW,
    ) -> bool:
        """
        Verify TOTP.

        valid_window=1
        accepts previous and next 30-second window
        to avoid clock drift issues.
        """

        if not secret:
            return False

        if not code:
            return False

        return cls.build_totp(secret).verify(
            otp=code,
            valid_window=valid_window,
        )

    @classmethod
    def provisioning_uri(
        cls,
        *,
        secret: str,
        email: str,
        issuer: str,
    ) -> str:
        """
        Returns otpauth URI.

        Used by QR code generator.

        Example:

        otpauth://totp/MyStudio:user@email.com...
        """

        return cls.build_totp(secret).provisioning_uri(
            name=email,
            issuer_name=issuer,
        )

    @classmethod
    def remaining_seconds(
        cls,
        secret: str,
    ) -> int:
        """
        Seconds until next code rotation.
        """

        return cls.build_totp(secret).interval - (
            pyotp.utils.time.time() % cls.build_totp(secret).interval
        )

    @classmethod
    def at(
        cls,
        *,
        secret: str,
        timestamp: int,
    ) -> str:
        """
        Generate code for a specific timestamp.

        Useful for testing.
        """

        return cls.build_totp(secret).at(timestamp)

    @classmethod
    def verify_at(
        cls,
        *,
        secret: str,
        code: str,
        timestamp: int,
        valid_window: int = DEFAULT_WINDOW,
    ) -> bool:
        totp = cls.build_totp(secret)

        return totp.verify(
            otp=code,
            for_time=timestamp,
            valid_window=valid_window,
        )
