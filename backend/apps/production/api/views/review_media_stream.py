"""
Review media playback: the only way a proxy, thumbnail or filmstrip leaves the server (C-RP-21).

The link carries a signed token naming the user, the row and the output, so ``<video src>`` and
``<img src>`` work without an Authorization header. Every request re-checks that the user is active,
holds ``version.view`` and still reads the version, and that the row is still ready; anything else
is one 404. Behind nginx (``MEDIA_ACCEL_PREFIX``) the file leaves through ``X-Accel-Redirect`` and
nginx answers ranges; without it Django answers a single range itself, so seeking works in
development too. The uploaded source is never served.

RP-23 (C-RP-56, C-RP-57): the output ``download`` serves the proxy as an attachment named after the
version, while the project's ``review_downloads`` lets this user download, checked on every request.
Each download is an audit row, written once per download: for a request without a range or with one
that starts at byte 0, so a resumed download or a player's seeking is not counted again.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from django.utils.http import content_disposition_header
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.production.constants.permissions import VersionPermissions
from apps.production.models import ReviewMedia
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services import review_media_links
from apps.production.services.review_media import record_download

_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")
_CHUNK = 512 * 1024


def _may_view(user) -> bool:
    if user.is_superuser:
        return True
    from apps.identity.services.permission_cache import PermissionCacheService

    return PermissionCacheService.has_permission(user=user, permission=VersionPermissions.VIEW)


def _may_download(user, row: ReviewMedia) -> bool:
    """The project's ``review_downloads`` now, for this user (C-RP-56, Q-RP-105)."""
    external = not ProductionBaseSelector.is_platform_admin(user) and row.project_id in {  # pyright: ignore[reportAttributeAccessIssue]
        grant.project_id for grant in ProductionBaseSelector.external_grants(user)
    }
    allowed = review_media_links.downloads_of(row.project_id)  # pyright: ignore[reportAttributeAccessIssue]
    return review_media_links.may_download(allowed, external=external)


def _starts_a_download(header: str) -> bool:
    """Whether a request is the start of a download: no range (or one not understood, which is served
    whole), or a range from byte 0. A suffix range (``bytes=-500``) is never the start."""
    match = _RANGE.match(header.strip())
    if not match:
        return True
    return match.group(1) != "" and int(match.group(1)) == 0


def _byte_range(header: str, size: int) -> tuple[int, int] | None | Literal[False]:
    """``(first, last)`` of a single satisfiable range, ``None`` without one, ``False`` when unsatisfiable."""
    match = _RANGE.match(header.strip())
    if not match:
        return None  # absent, malformed or several ranges: the whole file
    first_text, last_text = match.groups()
    if not first_text and not last_text:
        return None
    if not first_text:  # the last N bytes
        length = int(last_text)
        if length == 0:
            return False
        return max(0, size - length), size - 1
    first = int(first_text)
    last = int(last_text) if last_text else size - 1
    if first >= size or last < first:
        return False
    return first, min(last, size - 1)


def _read(path: Path, first: int, length: int):
    with path.open("rb") as handle:
        handle.seek(first)
        remaining = length
        while remaining > 0:
            chunk = handle.read(min(_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


class ReviewMediaStreamView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)  # the signed token is the credential

    @extend_schema(
        parameters=[
            OpenApiParameter("token", OpenApiTypes.STR, OpenApiParameter.QUERY, required=True)
        ],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    def get(self, request, pk, output):
        payload = review_media_links.read_token(request.query_params.get("token", ""))
        if (
            payload is None
            or output not in review_media_links.OUTPUTS
            or payload["m"] != str(pk)
            or payload["o"] != output
        ):
            raise NotFound()

        user = get_user_model().objects.filter(pk=payload["u"], is_active=True).first()
        if user is None or not _may_view(user):
            raise NotFound()

        row = ReviewMediaSelector.resolve_for(user, pk)
        if row is None or row.status != ReviewMedia.Status.READY:
            raise NotFound()
        download = output == "download"
        if download and not _may_download(user, row):
            raise NotFound()
        stored = {
            "proxy": row.proxy_path,
            "thumbnail": row.thumbnail_path,
            "filmstrip": row.filmstrip_path,
            # RP-25 (C-RP-59): the slated file when the copy has one
            "download": review_media_links.download_path(row),
        }[output]
        path = Path(settings.MEDIA_ROOT) / stored
        if not stored or not path.is_file():
            raise NotFound()

        content_type = "video/mp4" if stored.endswith(".mp4") else "image/jpeg"
        response = self._file_response(request, path, stored, content_type)
        # The bytes are data, never a page: no sniffing, no scripts, no caching by shared caches.
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        response["Cache-Control"] = "private, no-store"
        if download:
            response["Content-Disposition"] = content_disposition_header(
                True, review_media_links.download_name(row)
            )
            if response.status_code in (200, 206) and _starts_a_download(
                request.headers.get("Range", "")
            ):
                record_download(user=user, media=row, request=request)
        return response

    @staticmethod
    def _file_response(request, path: Path, stored: str, content_type: str) -> HttpResponseBase:
        prefix = settings.MEDIA_ACCEL_PREFIX
        if prefix:
            response = HttpResponse(content_type=content_type)
            response["X-Accel-Redirect"] = f"{prefix}/{quote(stored)}"
            return response

        size = path.stat().st_size
        wanted = _byte_range(request.headers.get("Range", ""), size)
        if wanted is False:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{size}"
            return response
        if wanted is None:
            response = FileResponse(path.open("rb"), content_type=content_type)
        else:
            first, last = wanted
            length = last - first + 1
            response = StreamingHttpResponse(
                _read(path, first, length), status=206, content_type=content_type
            )
            response["Content-Range"] = f"bytes {first}-{last}/{size}"
            response["Content-Length"] = str(length)
        response["Accept-Ranges"] = "bytes"
        return response
