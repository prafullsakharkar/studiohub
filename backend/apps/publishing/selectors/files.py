"""
Read side of the published file registry.

``PublishedFileSelector.get_queryset`` is what the API reads, narrowed to the caller's projects.
``files_for_versions`` / ``deliverable_files`` are the interface other apps (Deliveries) read
files through (delivery-pipeline CONTRACTS X-04): plain values, no model instances.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet

from apps.core.selectors.base import BaseSelector
from apps.production.selectors.base import ProductionBaseSelector
from apps.publishing.models import PublishedFile, StorageRoot


@dataclass(frozen=True)
class FileSnapshot:
    file_id: UUID
    version_id: UUID
    project_id: UUID
    storage_root_code: str
    relative_path: str
    role: str
    file_type_code: str
    size_bytes: int
    sha256: str
    frame_start: int | None
    frame_end: int | None
    status: str
    #: declared / verified / mismatch / missing (docs/publishing/CONTRACTS.md DOM-PUB-04)
    checksum_state: str = "declared"


def _snapshot(file: PublishedFile) -> FileSnapshot:
    return FileSnapshot(
        file_id=file.pk,
        version_id=file.version_id,  # pyright: ignore[reportAttributeAccessIssue]
        project_id=file.project_id,  # pyright: ignore[reportAttributeAccessIssue]
        storage_root_code=file.storage_root.code,
        relative_path=file.relative_path,
        role=file.role,
        file_type_code=file.file_type.code if file.file_type else "",
        size_bytes=file.size_bytes,
        sha256=file.sha256,
        frame_start=file.frame_start,
        frame_end=file.frame_end,
        status=file.status,
        checksum_state=file.checksum_state,
    )


class PublishedFileSelector(BaseSelector):
    model = PublishedFile

    #: query parameters the list accepts
    _FILTERS = ("version_id", "project_id", "status", "role")

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PublishedFile]:
        qs = PublishedFile.objects.select_related("storage_root", "file_type", "version")
        visible = ProductionBaseSelector.visible_project_ids(request) if request else []
        if visible is not None:  # None: platform admin, nothing narrows
            qs = qs.filter(project_id__in=visible)
        params = getattr(request, "query_params", None)
        if params is not None:
            for name in cls._FILTERS:
                value = params.get(name)
                if value:
                    try:
                        qs = qs.filter(**{name: UUID(value) if name.endswith("_id") else value})
                    except ValueError:
                        return qs.none()
            root = params.get("storage_root")
            if root:
                qs = qs.filter(storage_root__code__iexact=root)
            if str(params.get("latest", "")).lower() in {"1", "true", "yes"}:
                qs = cls.only_latest(qs)
        return qs

    @classmethod
    def only_latest(cls, qs: QuerySet[PublishedFile]) -> QuerySet[PublishedFile]:
        """
        The newest Registered file of each version and role.

        "Latest" is derived, never stored, so it cannot go stale: a deprecated or revoked file
        stops being latest and the one registered before it takes its place. Ties on the
        registration time break on the id so exactly one file wins.
        """
        newer = PublishedFile.objects.filter(
            version_id=OuterRef("version_id"),
            role=OuterRef("role"),
            status=PublishedFile.Status.REGISTERED,
        ).filter(
            Q(created_at__gt=OuterRef("created_at"))
            | Q(created_at=OuterRef("created_at"), pk__gt=OuterRef("pk"))
        )
        return qs.filter(status=PublishedFile.Status.REGISTERED).exclude(Exists(newer))

    @classmethod
    def latest_for_versions(
        cls, version_ids: Iterable[UUID]
    ) -> dict[tuple[UUID, str], FileSnapshot]:
        """``{(version id, role): snapshot}`` of the latest Registered file of each, for other apps."""
        rows = cls.only_latest(
            PublishedFile.objects.filter(version_id__in=list(version_ids))
        ).select_related("storage_root", "file_type")
        return {(file.version_id, file.role): _snapshot(file) for file in rows}  # pyright: ignore[reportAttributeAccessIssue]

    @classmethod
    def files_for_versions(cls, version_ids: Iterable[UUID]) -> dict[UUID, list[FileSnapshot]]:
        rows = PublishedFile.objects.filter(version_id__in=list(version_ids)).select_related(
            "storage_root", "file_type"
        )
        return cls._group(rows)

    @classmethod
    def deliverable_files(cls, version_ids: Iterable[UUID]) -> dict[UUID, list[FileSnapshot]]:
        """Registered files of published, live versions whose checksum is not known to be wrong."""
        rows = (
            PublishedFile.objects.filter(
                version_id__in=list(version_ids),
                status=PublishedFile.Status.REGISTERED,
                version__is_published=True,
                version__is_deleted=False,
            )
            .exclude(
                checksum_state__in=[
                    PublishedFile.ChecksumState.MISMATCH,
                    PublishedFile.ChecksumState.MISSING,
                ]
            )
            .select_related("storage_root", "file_type")
        )
        return cls._group(rows)

    @staticmethod
    def _group(rows: Iterable[PublishedFile]) -> dict[UUID, list[FileSnapshot]]:
        grouped: dict[UUID, list[FileSnapshot]] = {}
        for file in rows:
            grouped.setdefault(file.version_id, []).append(_snapshot(file))  # pyright: ignore[reportAttributeAccessIssue]
        return grouped


class StorageRootSelector(BaseSelector):
    model = StorageRoot

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[StorageRoot]:
        return StorageRoot.objects.all()


__all__: list[Any] = ["FileSnapshot", "PublishedFileSelector", "StorageRootSelector"]
