"""
Attachment validators.
"""

from __future__ import annotations

from pathlib import PurePath
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.core.exceptions import ValidationError

if TYPE_CHECKING:
    from apps.core.models.attachment import Attachment

__all__ = ["AttachmentValidator"]


# Text a browser would run if it sniffed the file as a page. Checked at the start of the content,
# whatever the extension says.
_ACTIVE_CONTENT_MARKERS = (
    b"<!doctype html",
    b"<html",
    b"<svg",
    b"<script",
    b"<?xml",
    b"<?php",
    b"#!",
)

_SNIFF_BYTES = 512


def attachment_extension(name: str) -> str:
    """Lower-case extension of ``name`` without the dot (``""`` when it has none)."""
    return PurePath(str(name or "")).suffix.lower().lstrip(".")


class AttachmentValidator:
    """Validator for Attachment models."""

    @staticmethod
    def validate_upload(file: Any) -> None:
        """
        Refuse an upload that is too large, has an unlisted extension, or looks like web content.

        The limits are settings (``ATTACHMENT_MAX_BYTES``, ``ATTACHMENT_ALLOWED_EXTENSIONS``).
        """
        size = int(getattr(file, "size", 0) or 0)
        limit = int(settings.ATTACHMENT_MAX_BYTES)

        if size <= 0:
            raise ValidationError("The file is empty.")

        if size > limit:
            raise ValidationError(f"The file is larger than the {limit // (1024 * 1024)} MB limit.")

        extension = attachment_extension(getattr(file, "name", ""))

        if extension not in settings.ATTACHMENT_ALLOWED_EXTENSIONS:
            raise ValidationError(
                f"Files of type '{extension or 'no extension'}' are not accepted."
            )

        head = b""
        try:
            position = file.tell()
        except (AttributeError, OSError):
            position = None
        try:
            head = file.read(_SNIFF_BYTES) or b""
        finally:
            if position is not None:
                file.seek(position)

        start = head.lstrip().lower()

        if any(start.startswith(marker) for marker in _ACTIVE_CONTENT_MARKERS):
            raise ValidationError("The file content is not an accepted type.")

    @staticmethod
    def validate(**data: Any) -> None:
        """Validate data."""
        pass

    @staticmethod
    def validate_create(**data: Any) -> None:
        """Validate data for creation."""
        pass

    @staticmethod
    def validate_update(instance: Attachment, **data: Any) -> None:
        """Validate data for update."""
        pass

    @staticmethod
    def validate_delete(instance: Attachment) -> None:
        """Validate deletion."""
        pass

    @staticmethod
    def validate_activate(instance: Attachment) -> None:
        """Validate activation."""
        pass

    @staticmethod
    def validate_deactivate(instance: Attachment) -> None:
        """Validate deactivation."""
        pass

    @staticmethod
    def validate_archive(instance: Attachment) -> None:
        """Validate archiving."""
        pass
