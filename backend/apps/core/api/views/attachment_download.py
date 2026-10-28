"""
Attachment download: the only way an uploaded file leaves the system.

The link is issued with the attachment (see ``attachment_links``) and carries a signed,
short-lived token, so a plain ``<a href>`` or ``<img src>`` works without an Authorization header.
Access is re-checked on every use: the user must still be active and still be allowed to see the
attachment, and the attachment must not have expired or been deleted.
"""

from __future__ import annotations

import mimetypes
from pathlib import PurePath
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.http import FileResponse, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.http import content_disposition_header
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.logging.logger import get_logger
from apps.core.selectors.attachment import AttachmentSelector
from apps.core.services import attachment_links
from apps.core.utils.client_ip import client_ip_from_meta

logger = get_logger("attachments")


class AttachmentDownloadView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)  # the signed token is the credential

    def get(self, request, uuid):
        payload = attachment_links.read_token(request.query_params.get("token", ""))

        if payload is None or payload["a"] != str(uuid):
            raise NotFound()

        user = get_user_model().objects.filter(pk=payload["u"], is_active=True).first()

        if user is None:
            raise NotFound()

        attachment = AttachmentSelector.for_user(user).filter(pk=uuid).first()

        if attachment is None or not attachment.file:
            raise NotFound()

        stored_name = str(attachment.file.name)

        if not default_storage.exists(stored_name):
            raise NotFound()

        logger.info(
            "attachment_downloaded",
            attachment_id=str(attachment.pk),
            user_id=str(user.pk),
            ip=client_ip_from_meta(request.META),
            file_size=attachment.file_size,
        )

        return self._file_response(attachment)

    @staticmethod
    def _download_name(attachment) -> str:
        name = (attachment.name or "").strip()
        if PurePath(name).suffix:
            return name
        extension = attachment.extension
        base = name or "attachment"
        return f"{base}.{extension}" if extension else base

    def _file_response(self, attachment) -> HttpResponseBase:
        name = self._download_name(attachment)
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        prefix = settings.MEDIA_ACCEL_PREFIX

        if prefix:
            response = HttpResponse(content_type=content_type)
            response["X-Accel-Redirect"] = f"{prefix}/{quote(attachment.file.name)}"
            response["Content-Disposition"] = content_disposition_header(True, name)
        else:
            response = FileResponse(
                attachment.file.open("rb"),
                as_attachment=True,
                filename=name,
                content_type=content_type,
            )

        # The bytes are data, never a page: no sniffing, no scripts, no caching by shared caches.
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        response["Cache-Control"] = "private, no-store"
        return response
