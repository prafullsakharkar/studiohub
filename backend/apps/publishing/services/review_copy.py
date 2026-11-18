"""
A review copy read from a registered published file (review-pipeline RP-17, C-RP-44; ADR-0042).

Publishing decides which file may be read (Q-RP-77 to Q-RP-79). It must be in the caller's reach,
Registered or Deprecated, of role ``main`` or ``proxy``, with a checksum that is not known to be wrong,
and on a root the servers read (``PUBLISHING_STORAGE_MOUNTS``, Q-RP-78). Production's review-media
service then queues the copy on the file's own version. Publishing imports production, never the
reverse; production keeps only the root's code, the registered path and the file's id.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.core.api.exceptions.api import NotFoundException
from apps.production.exceptions import ReviewMediaDisabled
from apps.production.permissions.review_media import require_manage_review_media
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services.review_media import (
    ReviewMediaService,
    StorageSource,
    storage_problem,
    storage_readable,
)
from apps.publishing.models import PublishedFile

#: the roles a review copy may be read from (Q-RP-77): the file itself or its proxy, not sidecars
ROLES = frozenset({PublishedFile.Role.MAIN, PublishedFile.Role.PROXY})


def make_review_copy(
    *, actor: Any, request: Any, file: PublishedFile, color_space: str = ""
) -> Any:
    """
    ``POST publishing/files/{id}/review-copy/``: queue a copy of ``file``'s version read from it.

    Answers production's queued review-media row; typed ``Any`` because publishing reads production
    through its services and selectors, never its models (X-03, ``test_dependency_direction``).
    """
    if not settings.REVIEW_MEDIA_ENABLED:
        raise ReviewMediaDisabled()  # as for an upload (C-RP-19)
    # C-RP-26: the version must be in reach (the review-media narrowing), as for an upload.
    version = (
        ReviewMediaSelector.readable_versions(actor).filter(pk=file.version_id).first()  # pyright: ignore[reportAttributeAccessIssue]
    )
    if version is None:
        raise NotFoundException()
    require_manage_review_media(request, version)
    problem = refusal(file)
    if problem:
        raise ValidationError({"detail": [problem]})
    return ReviewMediaService.open_from_storage(
        actor=actor,
        version=version,
        source=StorageSource(
            root=file.storage_root.code,
            path=file.relative_path,
            published_file_id=file.pk,
            first_frame=file.frame_start,
            last_frame=file.frame_end,
        ),
        color_space=color_space,
    )


def refusal(file: PublishedFile) -> str | None:
    """Why ``file`` cannot be read for a review copy, one sentence, or ``None`` (C-RP-44)."""
    if file.status == PublishedFile.Status.REVOKED:
        return "This file was revoked; a review copy cannot be made from it."
    if file.role not in ROLES:
        return "A review copy is made from a main or proxy file, not a thumbnail or sidecar."
    if file.checksum_state == PublishedFile.ChecksumState.MISMATCH:
        return "This file does not match its checksum; a review copy cannot be made from it."
    if file.checksum_state == PublishedFile.ChecksumState.MISSING:
        return "This file was not found on its storage root when it was last verified."
    if not storage_readable(file.storage_root.code):
        return f"The server does not read the storage root {file.storage_root.code}."
    return storage_problem(file.relative_path, file.frame_start, file.frame_end)
