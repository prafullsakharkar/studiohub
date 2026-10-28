"""
Published files: the registry of what a published version consists of (CONTRACTS DOM-PUB-02).

A row names one file, or one image sequence, under a storage root with its SHA-256. Once
registered only the lifecycle fields change; corrections are new rows (Q26).
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.bases.entity import EntityModel
from apps.core.models.managers import AllObjectsManager, SoftDeleteManager
from apps.core.models.querysets import SoftDeleteQuerySet

# Who-did-it columns. Django nulls them when a user is removed for good (SET_NULL), so they are not
# part of what a registered file *is*.
ATTRIBUTION_FIELDS = frozenset(
    {
        "created_by",
        "created_by_id",
        "updated_by",
        "updated_by_id",
        "deleted_by",
        "deleted_by_id",
        "status_changed_by",
        "status_changed_by_id",
    }
)

# The only columns a registered file may change. Everything else is the record of what was registered.
LIFECYCLE_FIELDS = ATTRIBUTION_FIELDS | frozenset(
    {
        "status",
        "status_changed_at",
        "revoke_reason",
        "checksum_state",
        "checksum_checked_at",
        "updated_at",
    }
)


class ImmutableRecordError(ValueError):
    """A registered file's identity fields were about to change."""


class PublishedFileQuerySet(SoftDeleteQuerySet):
    def update(self, **kwargs: Any) -> int:
        frozen = sorted(set(kwargs) - LIFECYCLE_FIELDS)
        if frozen:
            raise ImmutableRecordError(f"A registered file cannot change: {', '.join(frozen)}.")
        return super().update(**kwargs)

    def delete(self) -> tuple[int, dict[str, int]]:
        raise ImmutableRecordError("A registered file cannot be deleted.")


class PublishedFileManager(SoftDeleteManager):
    def get_queryset(self) -> PublishedFileQuerySet:
        return PublishedFileQuerySet(self.model, using=self._db).alive()


class PublishedFileAllManager(AllObjectsManager):
    def get_queryset(self) -> PublishedFileQuerySet:
        return PublishedFileQuerySet(self.model, using=self._db)


class PublishedFile(EntityModel):
    class Role(models.TextChoices):
        MAIN = "main", "Main"
        PROXY = "proxy", "Proxy"
        THUMBNAIL = "thumbnail", "Thumbnail"
        SIDECAR = "sidecar", "Sidecar"

    class Status(models.TextChoices):
        REGISTERED = "Registered", "Registered"
        DEPRECATED = "Deprecated", "Deprecated"
        REVOKED = "Revoked", "Revoked"

    class ChecksumState(models.TextChoices):
        DECLARED = "declared", "Declared"
        VERIFIED = "verified", "Verified"
        MISMATCH = "mismatch", "Mismatch"
        MISSING = "missing", "Missing"

    version = models.ForeignKey(
        "production.Version", on_delete=models.PROTECT, related_name="published_files"
    )
    # Copied from the version by the service, never taken from a request body.
    project = models.ForeignKey(
        "production.Project", on_delete=models.PROTECT, related_name="published_files"
    )
    storage_root = models.ForeignKey(
        "publishing.StorageRoot", on_delete=models.PROTECT, related_name="files"
    )
    relative_path = models.CharField(max_length=1024)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MAIN)
    file_type = models.ForeignKey(
        "masterdata.MasterFileType",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    size_bytes = models.BigIntegerField()
    sha256 = models.CharField(max_length=64)
    frame_start = models.IntegerField(null=True, blank=True)
    frame_end = models.IntegerField(null=True, blank=True)
    checksum_state = models.CharField(
        max_length=10, choices=ChecksumState.choices, default=ChecksumState.DECLARED
    )
    checksum_checked_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.REGISTERED, db_index=True
    )
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    revoke_reason = models.TextField(blank=True, default="")
    export_job = models.ForeignKey(
        "publishing.PublishItem",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="published_files",
    )

    # Identity snapshot used by the save() guard; None until the row is loaded or first saved.
    _loaded_identity: dict[str, Any] | None = None

    objects = PublishedFileManager()  # pyright: ignore[reportAssignmentType]
    all_objects = PublishedFileAllManager()  # pyright: ignore[reportAssignmentType]

    class Meta:
        db_table = "publishing_file"
        ordering = ("version_id", "role", "relative_path")
        base_manager_name = "all_objects"
        constraints = [
            # A path, once registered, names that content forever (revoked rows included).
            models.UniqueConstraint(
                fields=["storage_root", "relative_path"], name="publishing_file_root_path_uniq"
            ),
            models.CheckConstraint(
                condition=models.Q(size_bytes__gte=0), name="publishing_file_size_ck"
            ),
            models.CheckConstraint(
                condition=models.Q(sha256__regex=r"^[0-9a-f]{64}$"),
                name="publishing_file_sha256_ck",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(frame_start__isnull=True, frame_end__isnull=True)
                    | models.Q(
                        frame_start__isnull=False,
                        frame_end__isnull=False,
                        frame_end__gte=models.F("frame_start"),
                    )
                ),
                name="publishing_file_frames_ck",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="Revoked") | ~models.Q(revoke_reason=""),
                name="publishing_file_revoke_reason_ck",
            ),
        ]
        indexes = [
            models.Index(fields=["version", "status"], name="publishing_file_ver_status_idx"),
            models.Index(fields=["project", "status"], name="publishing_file_proj_stat_idx"),
            models.Index(fields=["sha256"], name="publishing_file_sha256_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.storage_root_id}:{self.relative_path}"  # pyright: ignore[reportAttributeAccessIssue]

    # -- immutability guard (defence in depth; the service checks first) ----------------

    def _remember_identity(self) -> None:
        """Snapshot what the row is, so a later ``save()`` can tell if any of it changed."""
        self._loaded_identity = {
            field.attname: getattr(self, field.attname)
            for field in self._meta.concrete_fields
            if field.attname in self.__dict__
            and field.name not in LIFECYCLE_FIELDS
            and field.attname not in LIFECYCLE_FIELDS
        }

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        instance._remember_identity()
        return instance

    def save(self, *args: Any, **kwargs: Any) -> None:
        loaded = getattr(self, "_loaded_identity", None)
        if not self._state.adding and loaded is not None:
            changed = sorted(name for name, value in loaded.items() if getattr(self, name) != value)
            if changed:
                raise ImmutableRecordError(
                    f"A registered file cannot change: {', '.join(changed)}."
                )
        super().save(*args, **kwargs)
        if loaded is None:
            # Created here (or built without from_db): guard it from now on, like a loaded row.
            self._remember_identity()

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ImmutableRecordError("A registered file cannot be deleted.")


class PublishedFileEventQuerySet(models.QuerySet[Any]):
    def update(self, **kwargs: Any) -> int:
        raise TypeError("PublishedFileEvent is append-only.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise TypeError("PublishedFileEvent is append-only.")


class PublishedFileEvent(models.Model):
    """One line of a file's history: registration, a status move, or a checksum verification."""

    class Kind(models.TextChoices):
        REGISTERED = "registered", "Registered"
        STATUS = "status", "Status change"
        VERIFICATION = "verification", "Checksum verification"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.ForeignKey(
        "publishing.PublishedFile", on_delete=models.PROTECT, related_name="events"
    )
    kind = models.CharField(max_length=14, choices=Kind.choices)
    from_status = models.CharField(max_length=12, blank=True, default="")
    to_status = models.CharField(max_length=12, blank=True, default="")
    detail = models.CharField(max_length=40, blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reason = models.TextField(blank=True, default="")
    override_kind = models.CharField(max_length=40, blank=True, default="")
    at = models.DateTimeField(default=timezone.now, editable=False)

    objects = PublishedFileEventQuerySet.as_manager()

    class Meta:
        db_table = "publishing_file_event"
        ordering = ("at",)
        indexes = [models.Index(fields=["file", "at"], name="publishing_event_file_at_idx")]

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise TypeError("PublishedFileEvent is append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise TypeError("PublishedFileEvent is append-only.")
