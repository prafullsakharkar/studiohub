"""
Generic bulk operations for project-scoped production entities.

``BulkOperationServiceMixin`` generalizes the bulk machinery pioneered by
``SequenceService`` (existence classification, bulk create/update/archive/
restore with per-item partial-failure reporting) so Shots, Assets, and Tasks
— which share the ``(project, code)`` uniqueness contract — reuse one
implementation instead of three copies.

Concrete services set ``model`` (via ``BusinessService``) and
``bulk_update_serializer`` (DRF serializer used to validate per-item updates).
"""

from __future__ import annotations

from typing import Any, ClassVar

from django.db.models import QuerySet

from apps.core.services.business import BusinessService


class BulkOperationService(BusinessService):
    """Bulk create/update/archive/restore + existence check for one model."""

    model: ClassVar[Any] = None
    bulk_update_serializer: ClassVar[Any] = None

    # Result statuses (stable wire values; the API layer maps them to the
    # frontend contract shapes).
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
        from django.core.exceptions import ValidationError as DjangoValidationError

        from apps.production.models import Project

        if not project_id:
            return None
        try:
            instance = Project.objects.filter(
                organization=organization,
                id=project_id,
            ).first()
            if instance is not None:
                return instance
        except (ValueError, TypeError, DjangoValidationError):
            pass
        return Project.objects.filter(
            organization=organization,
            code__iexact=str(project_id),
        ).first()

    @classmethod
    def _existing(cls, *, organization, project, code):
        return (
            cls.model.all_objects.filter(
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
        Create multiple entities from validated flat input items.

        Each item carries ``project_id`` + ``code`` + entity fields.
        Per-item statuses: ``created`` | ``exists`` | ``soft_deleted`` |
        ``duplicate`` | ``invalid``. Each creation runs in its own atomic
        transaction so one bad row does not roll back the others.
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
        Update multiple entities by id (organization scoped).

        Per-item statuses: ``updated`` | ``not_found`` | ``invalid``.
        Items are validated with ``bulk_update_serializer`` when configured.
        """
        assert cls.bulk_update_serializer is not None, (
            "bulk_update_serializer must be set on the service class."
        )
        results = []
        for index, item in enumerate(items):
            item_id = item.get("id")
            if not item_id:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "id is required."}
                )
                continue
            instance = cls.model.all_objects.filter(
                organization=organization,
                id=item_id,
            ).first()
            if instance is None or instance.is_deleted:
                results.append(
                    {"index": index, "status": cls.NOT_FOUND, "error": f"{cls.model.__name__} not found."}
                )
                continue
            data = {k: v for k, v in item.items() if k != "id"}
            serializer = cls.bulk_update_serializer(instance=instance, data=data, partial=True)
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
        Soft-delete (archive) multiple entities by id.
        Per-item statuses: ``archived`` | ``not_found``.
        """
        results = []
        for index, item_id in enumerate(ids):
            instance = cls.model.objects.filter(
                organization=organization,
                id=item_id,
            ).first()
            if instance is None:
                results.append(
                    {"index": index, "id": item_id, "status": cls.NOT_FOUND}
                )
                continue
            cls.delete(instance, user=user)
            results.append(
                {"index": index, "id": item_id, "status": cls.ARCHIVED}
            )
        return results

    @classmethod
    def bulk_restore(cls, ids, *, organization, user=None):
        """
        Restore soft-deleted entities by id.
        Per-item statuses: ``restored`` | ``not_found``.
        """
        results = []
        for index, item_id in enumerate(ids):
            instance = cls.model.all_objects.filter(
                organization=organization,
                id=item_id,
            ).first()
            if instance is None or not instance.is_deleted:
                results.append(
                    {"index": index, "id": item_id, "status": cls.NOT_FOUND}
                )
                continue
            cls.restore(instance)
            results.append(
                {"index": index, "id": item_id, "status": cls.RESTORED}
            )
        return results

    # ------------------------------------------------------------------
    # Bulk fetch (for archive/restore UI)
    # ------------------------------------------------------------------

    @classmethod
    def get_archived(cls, *, organization, project_id=None) -> QuerySet[Any, Any]:
        qs = cls.model.all_objects.filter(organization=organization, is_deleted=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs
