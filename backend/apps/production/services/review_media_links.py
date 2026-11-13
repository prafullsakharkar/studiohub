"""
Signed playback links for review media (docs/review-pipeline/CONTRACTS.md C-RP-21, Q-RP-28).

A browser cannot send the API token with ``<video src>``, so a reader of the version gets links that
carry a signed token bound to one user, one row and one output, valid for
``REVIEW_MEDIA_LINK_TTL_SECONDS``. The stream view re-checks the user and their access on every
request, so a link never outlives the user's access. Like attachment links (``core.attachment_links``).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.core import signing
from django.urls import reverse
from django.utils import timezone

_SALT = "production.review_media.stream"

#: what a row can serve, by the name in the link
OUTPUTS = ("proxy", "thumbnail", "filmstrip")


def make_token(media: Any, user: Any, output: str) -> str:
    return signing.dumps(
        {"m": str(media.pk), "u": str(user.pk), "o": output}, salt=_SALT, compress=False
    )


def read_token(token: str) -> dict[str, str] | None:
    """The token's payload, or ``None`` when it is missing, forged or expired."""
    if not token:
        return None
    try:
        payload = signing.loads(token, salt=_SALT, max_age=settings.REVIEW_MEDIA_LINK_TTL_SECONDS)
    except signing.BadSignature:
        return None
    if not isinstance(payload, dict) or not {"m", "u", "o"} <= set(payload):
        return None
    return payload


def stream_path(media: Any, user: Any, output: str) -> str:
    """Relative link (path and token) for ``user`` to read ``output`` of ``media``."""
    path = reverse(
        "api:v1:production:review-media-stream", kwargs={"pk": media.pk, "output": output}
    )
    return f"{path}?token={make_token(media, user, output)}"


def expires_at() -> datetime:
    """When links issued now stop working."""
    return timezone.now() + timedelta(seconds=settings.REVIEW_MEDIA_LINK_TTL_SECONDS)
