"""
Restricted sessions (TPN review TM-007, SEC-AUTH-06).

A signed-in user can owe something before they may use the API: set a new password after an
administrator's reset (or the first login of a bootstrapped account), or enroll the second factor the
policy requires of them. Until it is done the session may reach only the endpoints that settle the
debt, plus ``me`` and ``logout``. Everything else is a 403 with a stable code.

The check lives in the authenticator so no view can forget it: the client's redirect to an enrollment
screen is convenience, this is the control.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import PermissionDenied

MFA_ENROLLMENT_REQUIRED = "mfa_enrollment_required"
PASSWORD_CHANGE_REQUIRED = "password_change_required"

_API = "api:v1:"

_ALWAYS = frozenset(
    {
        f"{_API}auth-compat:auth-me",
        f"{_API}auth-compat:auth-logout",
        f"{_API}identity:logout",
    }
)

_MFA = frozenset(
    f"{_API}identity:{name}"
    for name in (
        "mfa-enroll",
        "mfa-verify",
        "mfa-recovery",
        "mfa-recovery-verify",
        "mfa-config-compat",
        "mfa-totp-setup",
        "mfa-totp-enable",
        "mfa-totp-verify",
        "mfa-recovery-codes",
        "mfa-recovery-codes-regenerate",
    )
)

_PASSWORD = frozenset(
    {
        f"{_API}auth-compat:auth-change-password",
        f"{_API}identity:change-password",
    }
)

_ALLOWED = {
    MFA_ENROLLMENT_REQUIRED: _ALWAYS | _MFA,
    PASSWORD_CHANGE_REQUIRED: _ALWAYS | _PASSWORD,
}

_MESSAGES = {
    MFA_ENROLLMENT_REQUIRED: "Set up two-factor authentication before continuing.",
    PASSWORD_CHANGE_REQUIRED: "Change your password before continuing.",
}


class RestrictedSession(PermissionDenied):
    """403 telling the client what has to be done first: ``{"detail": ..., "code": <code>}``."""

    #: read by the exception handler, which otherwise turns an authenticator's 403 into a 401
    keeps_forbidden_status = True

    def __init__(self, code: str):
        super().__init__(detail={"detail": _MESSAGES[code], "code": code}, code=code)


def pending(user: Any, token_payload: dict[str, Any]) -> list[str]:
    """What ``user`` still owes, in the order it should be settled."""
    owed = []

    # The claim is signed, and every change of the flag revokes the sessions it was issued to.
    if token_payload.get("must_change_password"):
        owed.append(PASSWORD_CHANGE_REQUIRED)

    if _mfa_enrollment_owed(user):
        owed.append(MFA_ENROLLMENT_REQUIRED)

    return owed


def _mfa_enrollment_owed(user: Any) -> bool:
    from apps.identity.models import UserMFA
    from apps.identity.services.mfa import MFAService

    if not MFAService.requires_mfa(user=user):
        return False

    mfa = UserMFA.objects.filter(user=user).first()

    return mfa is None or not mfa.requires_challenge


def enforce(request: Any, user: Any, token_payload: dict[str, Any]) -> None:
    """Raise ``RestrictedSession`` unless the endpoint settles every debt the user has."""
    owed = pending(user, token_payload)

    if not owed:
        return

    match = getattr(request, "resolver_match", None)
    view_name = getattr(match, "view_name", "") or ""

    for code in owed:
        if view_name not in _ALLOWED[code]:
            raise RestrictedSession(code)
