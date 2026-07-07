from __future__ import annotations

from django.conf import settings


class MFAPolicyService:
    """
    Enterprise MFA policy engine.

    Centralizes all decisions about when MFA is required.
    """

    REQUIRE_MFA = getattr(
        settings,
        "MFA_REQUIRE_MFA",
        False,
    )

    REQUIRE_STAFF_MFA = getattr(
        settings,
        "MFA_REQUIRE_STAFF",
        True,
    )

    REQUIRE_SUPERUSER_MFA = getattr(
        settings,
        "MFA_REQUIRE_SUPERUSER",
        True,
    )

    TRUSTED_DEVICE_ENABLED = getattr(
        settings,
        "MFA_TRUSTED_DEVICE_ENABLED",
        True,
    )

    REMEMBER_DEVICE_DAYS = getattr(
        settings,
        "MFA_TRUSTED_DEVICE_DAYS",
        30,
    )

    STEP_UP_PERMISSION_PREFIXES = getattr(
        settings,
        "MFA_STEP_UP_PERMISSION_PREFIXES",
        (
            "identity.",
            "organization.",
            "production.",
            "admin.",
        ),
    )

    @classmethod
    def is_required(cls, *, user) -> bool:
        if cls.REQUIRE_SUPERUSER_MFA and user.is_superuser:
            return True

        if cls.REQUIRE_STAFF_MFA and user.is_staff:
            return True

        return cls.REQUIRE_MFA

    @classmethod
    def can_skip(cls, *, user) -> bool:
        return not cls.is_required(user=user)

    @classmethod
    def can_trust_device(cls) -> bool:
        return cls.TRUSTED_DEVICE_ENABLED

    @classmethod
    def requires_step_up(
        cls,
        *,
        permission: str | None = None,
    ) -> bool:
        if not permission:
            return False

        return permission.startswith(tuple(cls.STEP_UP_PERMISSION_PREFIXES))

    @classmethod
    def requires_reauthentication(
        cls,
        *,
        sensitive: bool = False,
    ) -> bool:
        return sensitive

    @classmethod
    def should_prompt_mfa(
        cls,
        *,
        user,
        trusted_device: bool = False,
    ) -> bool:
        if not cls.is_required(user=user):
            return False

        if trusted_device and cls.can_trust_device():
            return False

        return True

    @classmethod
    def can_disable(
        cls,
        *,
        user,
    ) -> bool:
        """
        Prevent disabling MFA when enforced.
        """
        return not cls.is_required(user=user)

    @classmethod
    def requires_backup_codes(
        cls,
        *,
        user,
    ) -> bool:
        return cls.is_required(user=user)

    @classmethod
    def session_timeout_minutes(cls) -> int:
        return getattr(
            settings,
            "MFA_SESSION_TIMEOUT",
            30,
        )

    @classmethod
    def trusted_device_expiry_days(cls) -> int:
        return cls.REMEMBER_DEVICE_DAYS
