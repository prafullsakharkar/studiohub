"""
Short-lived download links for attachments.

An attachment file is never served by path. A caller who may see an attachment gets a link carrying
a signed token bound to that attachment and that user; the download endpoint re-checks access when
the link is used, so a link outlives neither its few minutes nor the user's access.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core import signing
from django.urls import reverse

_SALT = "core.attachment.download"


def make_token(attachment: Any, user: Any) -> str:
    return signing.dumps(
        {"a": str(attachment.pk), "u": str(user.pk)},
        salt=_SALT,
        compress=False,
    )


def read_token(token: str) -> dict[str, str] | None:
    """The token's payload, or ``None`` when it is missing, forged or expired."""
    if not token:
        return None
    try:
        payload = signing.loads(token, salt=_SALT, max_age=settings.ATTACHMENT_LINK_TTL_SECONDS)
    except signing.BadSignature:
        return None
    if not isinstance(payload, dict) or not {"a", "u"} <= set(payload):
        return None
    return payload


def download_path(attachment: Any, user: Any) -> str:
    """Relative link (path and token) for ``user`` to download ``attachment``."""
    path = reverse("api:v1:core:attachment-download", kwargs={"uuid": attachment.pk})
    return f"{path}?token={make_token(attachment, user)}"
