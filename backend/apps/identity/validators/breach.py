"""
Breached-password screening (TPN review TM-007, ADR-0038).

A Django password validator that rejects a password found in public breach corpora, using the Have I
Been Pwned range API. Only the first five hex characters of the password's SHA-1 are sent; the service
answers with every suffix sharing that prefix and the comparison is done here, so the password and its
full hash never leave the server. Responses are padded so their size does not reveal the prefix's
popularity.

Off unless ``PASSWORD_BREACH_CHECK`` is true, because it is an outbound call. If the service cannot be
reached the password is accepted (and a warning logged), unless ``PASSWORD_BREACH_CHECK_FAIL_CLOSED``
is true, in which case a password cannot be set while the service is down.
"""

from __future__ import annotations

import hashlib
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError

from apps.core.logging.logger import get_logger

logger = get_logger("authentication")

RANGE_URL = "https://api.pwnedpasswords.com/range/"
TIMEOUT_SECONDS = 2.0


def _suffix_counts(prefix: str) -> dict[str, int]:
    """The ``{suffix: times seen}`` the range API returns for ``prefix`` (padding entries count 0)."""
    request = urllib.request.Request(  # noqa: S310 - a fixed https URL, not caller-supplied
        RANGE_URL + prefix,
        headers={"Add-Padding": "true", "User-Agent": "studiohub-password-check"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
        body = response.read().decode("ascii", "replace")

    counts: dict[str, int] = {}
    for line in body.splitlines():
        suffix, _, number = line.strip().partition(":")
        if suffix and number.isdigit():
            counts[suffix.upper()] = int(number)
    return counts


class BreachedPasswordValidator:
    """Reject a password that appears in known breaches."""

    def validate(self, password: str, user: Any = None) -> None:
        if not getattr(settings, "PASSWORD_BREACH_CHECK", False):
            return

        digest = hashlib.sha1(password.encode(), usedforsecurity=False).hexdigest().upper()  # noqa: S324
        prefix, suffix = digest[:5], digest[5:]

        try:
            seen = _suffix_counts(prefix).get(suffix, 0)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            logger.warning("password_breach_check_unavailable")
            if getattr(settings, "PASSWORD_BREACH_CHECK_FAIL_CLOSED", False):
                raise ValidationError(
                    "The password could not be checked against known breaches right now. "
                    "Try again shortly.",
                    code="password_breach_check_unavailable",
                ) from None
            return

        if seen > 0:
            raise ValidationError(
                "This password appears in known data breaches. Choose a different one.",
                code="password_breached",
            )

    def get_help_text(self) -> str:
        return "Your password must not appear in known data breaches."
