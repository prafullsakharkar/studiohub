"""
Signed playback links for review media (docs/review-pipeline/CONTRACTS.md C-RP-21, Q-RP-28).

A browser cannot send the API token with ``<video src>``, so a reader of the version gets links that
carry a signed token bound to one user, one row and one output, valid for
``REVIEW_MEDIA_LINK_TTL_SECONDS``. The stream view re-checks the user and their access on every
request, so a link never outlives the user's access. Like attachment links (``core.attachment_links``).

RP-23 (C-RP-56, Q-RP-105, Q-RP-106): the output ``download`` serves the copy's proxy (the movie, or
the JPEG of a still) as an attachment, while the project's ``review_downloads`` lets the viewer:
studio members under ``internal``, also external (vendor, client) members under ``everyone``, nobody
under ``nobody``. The token names its output, so a playback link is never a download link.
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
OUTPUTS = ("proxy", "thumbnail", "filmstrip", "download")


def may_download(allowed: str, *, external: bool) -> bool:
    """Whether a reader of a version may download its copy, by its project's ``review_downloads``
    (Q-RP-105). ``external``: the reader is a vendor or client member of the project, not a platform
    admin.
    """
    if allowed == "everyone":
        return True
    return allowed == "internal" and not external


def downloads_of(project_id: Any) -> str:
    """The project's ``review_downloads`` now; ``nobody`` for a project that is gone."""
    from apps.production.models import Project

    found = Project.objects.filter(pk=project_id).values_list("review_downloads", flat=True).first()
    return found or "nobody"


def download_name(media: Any) -> str:
    """The file name a download is saved as: the version's code and the copy's extension."""
    extension = ".jpg" if str(media.proxy_path).endswith(".jpg") else ".mp4"
    return f"{media.version.code}{extension}"


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
