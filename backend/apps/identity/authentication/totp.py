from __future__ import annotations

import hmac
import time

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
    def matching_step(
        cls,
        *,
        secret: str,
        code: str,
        valid_window: int = DEFAULT_WINDOW,
        now: float | None = None,
    ) -> int | None:
        """
        Return the time step ``code`` is valid for, or ``None``.

        Callers record the returned step and refuse any step they have
        already consumed (replay prevention, DOM-MFA-04).
        """

        if not secret or not code:
            return None

        code = str(code).strip()

        totp = cls.build_totp(secret)

        current = int((time.time() if now is None else now) // totp.interval)

        # Check every step in the window; do not stop early so the work done
        # does not reveal which step (if any) matched.
        matched: int | None = None

        for step in range(current - valid_window, current + valid_window + 1):
            expected = totp.at(step * totp.interval)

            if hmac.compare_digest(expected, code) and matched is None:
                matched = step

        return matched

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
