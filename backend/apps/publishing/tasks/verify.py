"""
Checksum verification of registered files on storage roots the app server can read
(docs/publishing/CONTRACTS.md DOM-PUB-04, decision Q25).

Reads the file in chunks, compares with the declared SHA-256 and records ``verified``,
``mismatch`` or ``missing``. It never rewrites ``sha256`` and never raises on a bad file; a root
without a configured mount is skipped. Logs carry the file id and the result only.

The repository defines no Celery app (``config/celery.py`` is empty), so nothing queues this
automatically. Run ``manage.py verify_published_files`` by hand or from cron. ``verify_file`` is
also a ``shared_task``, ready for when an app is wired; called directly it just runs.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import structlog
from celery import shared_task
from django.conf import settings

from apps.publishing.domain.paths import PathRuleError, frame_file_name, resolve_mount
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService

logger = structlog.get_logger(__name__)

CHUNK = 1024 * 1024


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sequence_digest(frames: list[tuple[str, str]]) -> str:
    """SHA-256 of ``"<frame file name>  <frame sha256>\\n"`` lines sorted by name (the sha256sum format)."""
    text = "".join(f"{name}  {sha}\n" for name, sha in sorted(frames))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compute_checksum(mount: str, file: PublishedFile) -> str | None:
    """The file's (or sequence's) SHA-256 as read from disk, or ``None`` when something is missing."""
    if file.frame_start is None or file.frame_end is None:
        path = resolve_mount(mount, file.relative_path)
        return _hash_file(path) if path.is_file() else None
    frames: list[tuple[str, str]] = []
    for frame in range(file.frame_start, file.frame_end + 1):
        relative = frame_file_name(file.relative_path, frame)
        path = resolve_mount(mount, relative)
        if not path.is_file():
            return None
        frames.append((relative.rsplit("/", 1)[-1], _hash_file(path)))
    return sequence_digest(frames)


def verify_file(file_id: str) -> str | None:
    file = PublishedFile.all_objects.select_related("storage_root").filter(pk=file_id).first()
    if file is None:
        return None
    mount = settings.PUBLISHING_STORAGE_MOUNTS.get(file.storage_root.code.upper())
    if not mount:
        return None
    try:
        computed = compute_checksum(mount, file)
    except PathRuleError:
        computed = None
    except OSError:
        logger.warning("publishing_verify_unreadable", file_id=str(file.pk))
        return None  # the state stays as it was; a later run may succeed
    if computed is None:
        state = PublishedFile.ChecksumState.MISSING
    elif computed == file.sha256:
        state = PublishedFile.ChecksumState.VERIFIED
    else:
        state = PublishedFile.ChecksumState.MISMATCH
    PublishedFileService.record_verification(file_id=file.pk, state=state)
    logger.info("publishing_verified", file_id=str(file.pk), state=str(state))
    return str(state)


verify_file_task = shared_task(name="publishing.verify_file")(verify_file)


def verify_pending(*, root: str | None = None, limit: int | None = None) -> dict[str, int]:
    """Verify files whose checksum is still only declared, on roots that have a mount."""
    counts = {"verified": 0, "mismatch": 0, "missing": 0, "skipped": 0}
    mounted = [code for code in settings.PUBLISHING_STORAGE_MOUNTS]
    rows = (
        PublishedFile.objects.filter(checksum_state=PublishedFile.ChecksumState.DECLARED)
        .select_related("storage_root")
        .order_by("created_at")
    )
    if root:
        rows = rows.filter(storage_root__code__iexact=root)
    ids = [
        pk for pk, code in rows.values_list("pk", "storage_root__code") if code.upper() in mounted
    ]
    for pk in ids[:limit] if limit else ids:
        result = verify_file(str(pk))
        counts[result or "skipped"] += 1
    return counts
