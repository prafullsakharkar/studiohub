"""
Generic bulk operations for project-scoped production entities.

``BulkOperationService`` generalizes the bulk machinery pioneered by
``SequenceService`` (existence classification, bulk create/update/archive/
restore with per-item partial-failure reporting) so Shots, Assets, and Tasks
— which share the ``(project, code)`` uniqueness contract — reuse one
implementation instead of three copies.

Project scope only: every operation resolves the project globally (no
organization partition) and enforces project-membership gating per item —
out-of-scope projects/ids report ``invalid``/``not_found`` without an
existence leak. ``organization`` is still accepted as an ignored keyword so
the shared core bulk mixin (de-orged separately) keeps calling through.

Concrete services set ``model`` (via ``BusinessService``). Per-item update
validation belongs to the API layer: ``bulk_update`` is handed a ``validate``
callable and imports nothing from ``api``.
"""

from __future__ import annotations

from typing import Any, ClassVar

from django.db import transaction
from rest_framework.exceptions import APIException

from apps.core.logging.logger import get_logger
from apps.core.services.business import BusinessService

logger = get_logger("production")


class BulkOperationService(BusinessService):
    """Bulk create/update/archive/restore + existence check for one model."""

    model: ClassVar[Any] = None

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
    def _allowed_project_ids(cls, user):
        """
        Project ids the user may write via bulk operations.

        ``None`` means global access (superusers and holders of a global
        ADMIN-priority identity role); otherwise the user's active project
        membership set. Unauthenticated users get the empty set.
        """
        if user is None or not getattr(user, "is_authenticated", False):
            return set()
        if getattr(user, "is_superuser", False):
            return None
        from apps.production.models import ProjectMembership
        from apps.production.selectors.base import ProductionBaseSelector

        if ProductionBaseSelector._has_global_admin_role(user):
            return None
        return set(
            ProjectMembership.objects.filter(
                user=user,
                is_deleted=False,
                status__iexact="active",
            ).values_list("project_id", flat=True)
        )

    @classmethod
    def _get_project(cls, *, project_id, organization=None):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from apps.production.models import Project

        if not project_id:
            return None
        try:
            instance = Project.objects.filter(
                id=project_id,
            ).first()
            if instance is not None:
                return instance
        except (ValueError, TypeError, DjangoValidationError):
            pass
        return Project.objects.filter(
            code__iexact=str(project_id),
        ).first()

    @classmethod
    def _existing(cls, *, project, code, organization=None):
        return (
            cls.model.all_objects.filter(
                project=project,
                code=code,
            ).first()
        )

    # ------------------------------------------------------------------
    # Existence check
    # ------------------------------------------------------------------

    @classmethod
    def bulk_check_existence(cls, items, *, user=None, organization=None):
        """
        Classify each ``{project_id, code}`` item as one of
        ``new`` | ``exists`` | ``soft_deleted`` | ``duplicate`` | ``invalid``.
        """
        allowed = cls._allowed_project_ids(user)
        results = []
        seen = set()
        for index, item in enumerate(items):
            project = cls._get_project(
                project_id=item.get("project_id"),
            )
            code = cls._normalize_code(item.get("code"))
            if project is None:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "Invalid or missing project."}
                )
                continue
            if allowed is not None and project.id not in allowed:
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
    def bulk_create(cls, items, *, validate, user=None, organization=None):
        """
        Create multiple entities from flat input items.

        Each item carries ``project_id`` + ``code`` + entity fields.
        Per-item statuses: ``created`` | ``exists`` | ``soft_deleted`` |
        ``duplicate`` | ``invalid``. Each creation runs in its own atomic
        transaction so one bad row does not roll back the others.

        ``validate(project, item)`` is the API layer's check, the same one a
        single create runs; it returns ``(data to create with, None)`` or
        ``(None, errors)``. Only what it returns is stored.
        """
        allowed = cls._allowed_project_ids(user)
        results = []
        seen = set()
        for index, item in enumerate(items):
            project = cls._get_project(
                project_id=item.get("project_id"),
            )
            code = cls._normalize_code(item.get("code"))
            if project is None:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "Invalid or missing project."}
                )
                continue
            if allowed is not None and project.id not in allowed:
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

            data, errors = validate(project, item)
            if errors is not None:
                results.append({"index": index, "status": cls.INVALID, "error": errors})
                continue
            data = {**(data or {}), "project": project, "code": code}

            try:
                with transaction.atomic():
                    instance = cls.create(user=user, **data)
            except Exception:  # noqa: BLE001
                # The reason stays in the log; the client gets no database text.
                logger.exception("bulk_create_item_failed", model=cls.model.__name__, index=index)
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "The item could not be created."}
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
    def bulk_update(cls, items, *, validate, update=None, user=None, organization=None):
        """
        Update multiple entities by id (project-membership scoped).

        Per-item statuses: ``updated`` | ``not_found`` | ``invalid``.
        ``validate(instance, data)`` returns ``(validated_data, None)`` or
        ``(None, errors)``; items it rejects report ``invalid`` with the errors.
        ``update(instance, data)`` saves an accepted item (the API layer routes a
        status change through the workflow); by default ``cls.update``.
        """
        allowed = cls._allowed_project_ids(user)
        results = []
        for index, item in enumerate(items):
            item_id = item.get("id")
            if not item_id:
                results.append(
                    {"index": index, "status": cls.INVALID, "error": "id is required."}
                )
                continue
            lookup = cls.model.all_objects.filter(
                id=item_id,
            )
            if allowed is not None:
                lookup = lookup.filter(project_id__in=allowed)
            instance = lookup.first()
            if instance is None or instance.is_deleted:
                results.append(
                    {"index": index, "status": cls.NOT_FOUND, "error": f"{cls.model.__name__} not found."}
                )
                continue
            data = {k: v for k, v in item.items() if k != "id"}
            validated, errors = validate(instance, data)
            if errors is not None:
                results.append({"index": index, "status": cls.INVALID, "error": errors})
                continue
            try:
                with transaction.atomic():
                    if update is not None:
                        updated = update(instance, validated or {})
                    else:
                        updated = cls.update(instance, user=user, **(validated or {}))
            except APIException as exc:
                results.append({"index": index, "status": cls.INVALID, "error": exc.detail})
                continue
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
    def bulk_archive(cls, ids, *, user=None, organization=None):
        """
        Soft-delete (archive) multiple entities by id.
        Per-item statuses: ``archived`` | ``not_found``.
        """
        allowed = cls._allowed_project_ids(user)
        results = []
        for index, item_id in enumerate(ids):
            lookup = cls.model.objects.filter(
                id=item_id,
            )
            if allowed is not None:
                lookup = lookup.filter(project_id__in=allowed)
            instance = lookup.first()
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
    def bulk_restore(cls, ids, *, user=None, organization=None):
        """
        Restore soft-deleted entities by id.
        Per-item statuses: ``restored`` | ``not_found``.
        """
        allowed = cls._allowed_project_ids(user)
        results = []
        for index, item_id in enumerate(ids):
            lookup = cls.model.all_objects.filter(
                id=item_id,
            )
            if allowed is not None:
                lookup = lookup.filter(project_id__in=allowed)
            instance = lookup.first()
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

    # Bulk fetch (for archive/restore UI) is inherited from
    # ``apps.core.services.mixins.soft_delete.SoftDeleteMixin.get_archived``.
