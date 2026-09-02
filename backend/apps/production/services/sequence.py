"""
Sequence service.

Extends the canonical ``BusinessService`` (which provides create/update/
soft-delete/restore) with bulk operations. Bulk operations are organization
scoped, fail closed, resolve per-item existence, and report partial failures
so the client can reconcile (e.g. prompt to restore a soft-deleted row).

Soft-delete is the recoverable "archive" mechanism (see AGENTS soft-delete
rule): ``bulk_archive`` soft-deletes, ``bulk_restore`` un-deletes.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.services.business import BusinessService
from apps.production.models import Project, Sequence


class SequenceService(BusinessService):
    model = Sequence

    # Result statuses
    NEW = "new"
    CREATED = "created"
    EXISTS = "exists"
    SOFT_DELETED = "soft_deleted"
    DUPLICATE = "duplicate"
    INVALID = "invalid"
    UPDATED = "updated"
    ARCHIVED = "archived"
    RESTORED = "restored"
    NOT_FOUND = "not_found"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def _normalize_code(cls, code):
        return (code or "").strip().upper()

    @classmethod
    def _get_project(cls, *, organization, project_id):
        if not project_id:
            return None
        return (
            Project.objects.filter(
                organization=organization,
                id=project_id,
            ).first()
        )

    @classmethod
    def _existing(
        cls,
        *,
        organization,
        project,
        code,
    ):
        return (
            Sequence.all_objects.filter(
                organization=organization,
                project=project,
                code=code,
            ).first()
        )

    # ------------------------------------------------------------------
    # Existence check
    # ------------------------------------------------------------------

    @classmethod
    def bulk_check_existence(cls, items, *, organization):
        """
        Classify each ``{project_id, code}`` item as one of
        ``new`` | ``exists`` | ``soft_deleted`` | ``duplicate`` | ``invalid``.

        ``new`` means the code is available to create; ``soft_deleted`` means
        a recoverable row already occupies the code; ``duplicate`` means the
        code repeats within the same batch.
        """
        results = []
        seen = set()
        for index, item in enumerate(items):
            project = cls._get_project(
                organization=organization,
                project_id=item.get("project_id"),
            )
            code = cls._normalize_code(item.get("code"))
            if project is None:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "Invalid or missing project."}
                )
                continue
            if not code:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "Code is required."}
                )
                continue
            key = f"{project.id}:{code}"
            if key in seen:
                results.append({"index": index, "status": cls.DUPLICATE})
                continue
            seen.add(key)
            existing = cls._existing(
                organization=organization,
                project=project,
                code=code,
            )
            if existing is None:
                results.append({"index": index, "status": cls.NEW})
            elif existing.is_deleted:
                results.append(
                    {
                        "index": index,
                        "status": cls.SOFT_DELETED,
                        "id": str(existing.id),
                        "deleted_at": existing.deleted_at,
                    }
                )
            else:
                results.append(
                    {"index": index, "status": cls.EXISTS, "id": str(existing.id)}
                )
        return results

    # ------------------------------------------------------------------
    # Bulk create
    # ------------------------------------------------------------------

    @classmethod
    def bulk_create(cls, items, *, organization, user=None):
        """
        Create multiple sequences from validated input items.

        Per-item statuses: ``created`` | ``exists`` | ``soft_deleted`` |
        ``duplicate`` | ``invalid``. Each creation runs in its own atomic
        transaction so a failure on one row does not roll back the others
        (partial success is reported back to the client).
        """
        results = []
        seen = set()
        for index, item in enumerate(items):
            project = cls._get_project(
                organization=organization,
                project_id=item.get("project_id"),
            )
            code = cls._normalize_code(item.get("code"))
            if project is None:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "Invalid or missing project."}
                )
                continue
            if not code:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "Code is required."}
                )
                continue
            key = f"{project.id}:{code}"
            if key in seen:
                results.append(
                    {"index": index, "status": cls.DUPLICATE, "error": "Duplicate code within batch."}
                )
                continue
            seen.add(key)
            existing = cls._existing(
                organization=organization,
                project=project,
                code=code,
            )
            if existing is not None:
                if existing.is_deleted:
                    results.append(
                        {
                            "index": index,
                            "status": cls.SOFT_DELETED,
                            "id": str(existing.id),
                            "code": existing.code,
                            "deleted_at": existing.deleted_at,
                        }
                    )
                else:
                    results.append(
                        {
                            "index": index,
                            "status": cls.EXISTS,
                            "id": str(existing.id),
                            "code": existing.code,
                        }
                    )
                continue

            data = dict(item)
            data.pop("project_id", None)
            data["project"] = project
            data["code"] = code

            try:
                instance = cls.create(organization=organization, user=user, **data)
            except Exception as exc:  # noqa: BLE001
                results.append(
                    {"index": index, "status": cls.INVALID, "error": str(exc)}
                )
                continue

            results.append(
                {
                    "index": index,
                    "status": cls.CREATED,
                    "id": str(instance.id),
                    "entity": instance,
                }
            )
        return results

    # ------------------------------------------------------------------
    # Bulk update
    # ------------------------------------------------------------------

    @classmethod
    def bulk_update(cls, items, *, organization, user=None):
        """
        Update multiple sequences by id (organization scoped).

        Per-item statuses: ``updated`` | ``not_found`` | ``invalid``.
        """
        from apps.production.api.serializers.sequence.update import (
            SequenceUpdateSerializer,
        )

        results = []
        for index, item in enumerate(items):
            seq_id = item.get("id")
            if not seq_id:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "id is required."}
                )
                continue
            instance = Sequence.all_objects.filter(
                organization=organization,
                id=seq_id,
            ).first()
            if instance is None or instance.is_deleted:
                results.append(
                    {"index": index, "status": cls.NOT_FOUND, "error": "Sequence not found."}
                )
                continue
            data = {k: v for k, v in item.items() if k != "id"}
            serializer = SequenceUpdateSerializer(instance=instance, data=data, partial=True)
            if not serializer.is_valid():
                results.append(
                    {"index": index, "status": cls.INVALID, "error": serializer.errors}
                )
                continue
            updated = cls.update(instance, user=user, **serializer.validated_data)
            results.append(
                {
                    "index": index,
                    "status": cls.UPDATED,
                    "id": str(updated.id),
                    "entity": updated,
                }
            )
        return results

    # ------------------------------------------------------------------
    # Bulk archive / restore (soft-delete)
    # ------------------------------------------------------------------

    @classmethod
    def bulk_archive(cls, ids, *, organization, user=None):
        """
        Soft-delete (archive) multiple sequences by id.
        Per-item statuses: ``archived`` | ``not_found``.
        """
        results = []
        for index, seq_id in enumerate(ids):
            instance = Sequence.objects.filter(
                organization=organization,
                id=seq_id,
            ).first()
            if instance is None:
                results.append(
                    {"index": index, "id": seq_id, "status": cls.NOT_FOUND}
                )
                continue
            cls.delete(instance, user=user)
            results.append(
                {"index": index, "id": seq_id, "status": cls.ARCHIVED}
            )
        return results

    @classmethod
    def bulk_restore(cls, ids, *, organization, user=None):
        """
        Restore soft-deleted sequences by id.
        Per-item statuses: ``restored`` | ``not_found``.
        """
        results = []
        for index, seq_id in enumerate(ids):
            instance = Sequence.all_objects.filter(
                organization=organization,
                id=seq_id,
            ).first()
            if instance is None or not instance.is_deleted:
                results.append(
                    {"index": index, "id": seq_id, "status": cls.NOT_FOUND}
                )
                continue
            cls.restore(instance)
            results.append(
                {"index": index, "id": seq_id, "status": cls.RESTORED}
            )
        return results

    # ------------------------------------------------------------------
    # Bulk fetch (for archive/restore UI)
    # ------------------------------------------------------------------

    @classmethod
    def get_archived(cls, *, organization, project_id=None) -> QuerySet:
        qs = Sequence.all_objects.filter(organization=organization, is_deleted=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs
