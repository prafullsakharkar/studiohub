"""
Delivery items: what a version brings with it, taken from the published file registry
(docs/deliveries/CONTRACTS.md DOM-DLV-03, DOM-DLV-04, DOM-DLV-05).

The snapshot is the server's, never the caller's. Before the delivery is sent it is a preview that
``refresh`` rebuilds from the registry; sending freezes it.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.utils import timezone

from apps.deliveries.exceptions import UndeliverableVersion
from apps.deliveries.models import DeliveryItemFile, DeliveryVersionRef
from apps.production.selectors.version import VersionSelector
from apps.publishing.selectors.files import FileSnapshot, PublishedFileSelector

_PATH_LIMIT = 500  # DeliveryVersionRef.file_path


def check_deliverable(project_id: Any, version_id: Any) -> tuple[Any, list[FileSnapshot]]:
    """
    The version and its deliverable files, or ``UndeliverableVersion`` saying why not.

    A version qualifies when it is a live, published version of the delivery's project with at
    least one Registered file whose checksum is not known to be wrong (decision Q29).
    """
    version = VersionSelector.resolve_in_project(project_id, version_id)
    if version is None:
        raise UndeliverableVersion(UndeliverableVersion.UNKNOWN)
    if not version.is_published:
        raise UndeliverableVersion(UndeliverableVersion.NOT_PUBLISHED)
    files = PublishedFileSelector.deliverable_files([version.pk]).get(version.pk, [])
    if files:
        return version, files
    registered = [
        file
        for file in PublishedFileSelector.files_for_versions([version.pk]).get(version.pk, [])
        if file.status == "Registered"
    ]
    raise UndeliverableVersion(
        UndeliverableVersion.CHECKSUM if registered else UndeliverableVersion.NO_FILES
    )


def _frames(file: FileSnapshot) -> int:
    if file.frame_start is None or file.frame_end is None:
        return 0
    return file.frame_end - file.frame_start + 1


def apply_snapshot(ref: DeliveryVersionRef, version: Any, files: list[FileSnapshot]) -> None:
    """Fill the item from the version and replace its files with ``files`` (an unfrozen item only)."""
    main = next((f for f in files if f.role == "main"), files[0])
    ref.version_number = version.version_number
    ref.entity_type = version.entity_type
    ref.entity_code = version.entity_code
    ref.entity_name = version.entity_name
    ref.file_size_bytes = sum(f.size_bytes for f in files)
    ref.frame_count = sum(_frames(f) for f in files)
    ref.file_path = f"{main.storage_root_code}:{main.relative_path}"[:_PATH_LIMIT]
    ref.checksum_md5 = ""
    ref.checksum_sha256 = main.sha256
    ref.is_validated = False
    ref.validation_notes = ""
    ref.save()
    DeliveryItemFile.objects.filter(item=ref).delete()
    DeliveryItemFile.objects.bulk_create(
        DeliveryItemFile(
            item=ref,
            published_file_id=f.file_id,
            storage_root_code=f.storage_root_code,
            relative_path=f.relative_path,
            role=f.role,
            file_type_code=f.file_type_code,
            size_bytes=f.size_bytes,
            sha256=f.sha256,
            frame_start=f.frame_start,
            frame_end=f.frame_end,
        )
        for f in files
    )


def refresh(package: Any) -> list[dict[str, Any]]:
    """
    Rebuild every item's snapshot from the registry. Returns the items that could not be
    refreshed (the version is no longer deliverable), each with the reason; those keep their
    old snapshot so QC can report them.
    """
    problems: list[dict[str, Any]] = []
    for ref in package.versions.select_related("version"):
        try:
            version, files = check_deliverable(package.project_id, ref.version_id)
        except UndeliverableVersion as error:
            problems.append({"item": ref, "reason": error.reason})
            continue
        apply_snapshot(ref, version, files)
    return problems


def freeze(package: Any) -> None:
    """Freeze every file of every item: from now on the snapshot is the record of what was sent."""
    DeliveryItemFile.objects.filter(item__delivery=package, frozen_at__isnull=True).update(
        frozen_at=timezone.now()
    )


def find_item(package: Any, key: Any) -> DeliveryVersionRef | None:
    """An item of ``package`` by its uid (UUID) or by the older integer pk."""
    items = package.versions.all()
    try:
        return items.filter(uid=UUID(str(key))).first()
    except ValueError:
        pass
    try:
        return items.filter(pk=int(key)).first()
    except (TypeError, ValueError):
        return None
