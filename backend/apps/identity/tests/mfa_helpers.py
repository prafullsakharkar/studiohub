"""
MFA test helpers: drive the real enrollment lifecycle (no direct status writes).
"""

from __future__ import annotations

from apps.identity.authentication.totp import TOTPService
from apps.identity.models import UserMFA
from apps.identity.services.mfa import MFAService


def pending_secret(user) -> str:
    return UserMFA.objects.get(user=user).totp_secret


def valid_code(user, *, reset_replay: bool = True) -> str:
    """
    A currently valid TOTP code for ``user``.

    ``reset_replay`` forgets the last consumed time step so a test can verify
    more than once inside one 30-second step. Replay tests pass ``False``.
    """

    if reset_replay:
        UserMFA.objects.filter(user=user).update(last_used_step=None)

    return TOTPService.current_code(UserMFA.objects.get(user=user).totp_secret)


def enable_mfa(user) -> list[str]:
    """Enroll and activate through the service; returns the recovery codes."""

    MFAService.enroll(user=user)

    return MFAService.activate(
        user=user,
        code=TOTPService.current_code(pending_secret(user)),
    )
