"""
Catalog services (docs/masterdata/CONTRACTS.md §3).

Every catalog write goes through here: validate, then one
``transaction.atomic()`` that writes and publishes the domain event (the
event bus delivers it after commit). Views and serializers stay thin.

Errors: ``ValidationError`` (400) for bad input and duplicates found before
the write; ``MasterdataConflict`` (409) with a specific code for system rows,
dependants and illegal states; a unique-constraint race surfaces as the
database ``IntegrityError`` that the core handler maps to 409 ``conflict``.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, ClassVar
from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.core.api.exceptions.api import NotFoundException
from apps.core.services.soft_delete import SoftDeleteService
from apps.masterdata.events import records
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import (
    CatalogStatus,
    LookupCatalogModel,
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
)
from apps.masterdata.services.lifecycle import refuse_dependants, refuse_system_row
from apps.masterdata.validators import catalog as v


def _actor_or_none(actor):
    return (
        actor if getattr(actor, "pk", None) and getattr(actor, "is_authenticated", True) else None
    )


class CatalogService[CatalogT: LookupCatalogModel]:
    """Generic service for a ``LookupCatalogModel``; subclass per type."""

    model: type[CatalogT]  # pyright: ignore[reportUninitializedInstanceVariable]
    label: ClassVar[str] = "Record"
    #: Fields a caller may set. ``code`` and ``name`` are always handled here.
    extra_fields: ClassVar[tuple[str, ...]] = ()
    order_field: ClassVar[str] = "sort_order"

    # ---- hooks ---------------------------------------------------------

    @classmethod
    def derive_code(cls, values: Mapping[str, Any]) -> str:
        """Code to use when the caller gives none (file types override)."""
        return ""

    @classmethod
    def clean_extra(cls, name: str, value: Any) -> Any:
        """Validate one type-specific field. Default: accept as given."""
        return value

    @classmethod
    def duplicate_scope(cls, values: Mapping[str, Any]) -> dict[str, Any]:
        """Extra filter that narrows the uniqueness check (statuses: entity type)."""
        return {}

    @classmethod
    def before_save(cls, instance, *, creating: bool) -> None:
        """Last-moment, in-transaction adjustments (statuses: single default)."""

    # ---- helpers -------------------------------------------------------

    @classmethod
    def _live(cls):
        return cls.model.objects.all()

    @classmethod
    def _lock(cls, instance, *, include_deleted: bool = False):
        """Re-read ``instance`` under a row lock.

        A concurrent request may have deleted it since the view looked it up;
        that is a 404, not a server error.
        """
        manager = cls.model.all_objects if include_deleted else cls.model.objects
        try:
            return manager.select_for_update().get(pk=instance.pk)
        except cls.model.DoesNotExist:
            raise NotFoundException(f"{cls.label} not found.") from None

    @classmethod
    def _event(cls, event, instance, actor, **extra) -> None:
        event.dispatch(
            model=instance._meta.label,
            id=str(instance.pk),
            code=instance.code,
            name=instance.name,
            actor_id=str(actor.pk) if _actor_or_none(actor) else None,
            **extra,
        )

    @classmethod
    def _clean(cls, data: Mapping[str, Any], *, instance=None) -> dict[str, Any]:
        allowed = {"code", "name", "description", "metadata", "scope", *cls.extra_fields}
        unknown = set(data) - allowed
        if unknown:
            raise ValueError(f"Unsupported {cls.label} fields: {sorted(unknown)}")
        creating = instance is None
        out: dict[str, Any] = {}
        if "code" in data or creating:
            code = v.clean_text(
                data.get("code"), "code", required=False, max_length=v.CODE_MAX_LENGTH
            )
            code = code or v.clean_text(
                cls.derive_code(data), "code", required=False, max_length=v.CODE_MAX_LENGTH
            )
            if not code:
                raise ValidationError({"code": ["This field is required."]})
            out["code"] = code
        if "name" in data or creating:
            out["name"] = v.clean_text(
                data.get("name"), "name", required=True, max_length=v.NAME_MAX_LENGTH
            )
        if "description" in data:
            out["description"] = v.clean_text(
                data["description"], "description", required=False, max_length=10_000
            )
        if "metadata" in data:
            out["metadata"] = v.clean_metadata(data["metadata"])
        if "scope" in data:
            out["scope"] = v.clean_scope(data["scope"])
        for field in cls.extra_fields:
            if field in data:
                out[field] = cls.clean_extra(field, data[field])
        return out

    @classmethod
    def _refuse_duplicates(cls, values: Mapping[str, Any], *, instance=None, scope=None) -> None:
        """400 for a code/name already used by a live row (case-insensitive)."""
        qs = cls._live()
        if instance is not None:
            qs = qs.exclude(pk=instance.pk)
        if scope:
            qs = qs.filter(**scope)
        errors: dict[str, list[str]] = {}
        for field in ("code", "name"):
            if field in values and qs.filter(**{f"{field}__iexact": values[field]}).exists():
                errors[field] = [f"A {cls.label.lower()} with this {field} already exists."]
        if errors:
            raise ValidationError(errors)

    # ---- operations ----------------------------------------------------

    @classmethod
    def create(cls, *, actor, data: Mapping[str, Any], system: bool = False) -> CatalogT:
        values = cls._clean(data)
        with transaction.atomic():
            cls._refuse_duplicates(values, scope=cls.duplicate_scope(values))
            instance = cls.model(**values, is_system=system)
            who = _actor_or_none(actor)
            instance.created_by = instance.updated_by = who
            cls.before_save(instance, creating=True)
            instance.save()
            cls._event(records.MasterdataRecordCreated, instance, actor, fields=sorted(values))
        return instance

    @classmethod
    def update(cls, *, actor, instance: CatalogT, data: Mapping[str, Any]) -> CatalogT:
        values = cls._clean(data, instance=instance)
        with transaction.atomic():
            instance = cls._lock(instance)
            if instance.is_system and values.get("code", instance.code) != instance.code:
                raise MasterdataConflict(
                    "The code of a system record cannot change.", code="system_row_protected"
                )
            changed = sorted(k for k, val in values.items() if getattr(instance, k) != val)
            if not changed:
                return instance
            merged = {**cls._current(instance), **values}
            recheck = {
                field: merged[field]
                for field in ("code", "name")
                if field in changed or field in cls.scope_keys(changed)
            }
            cls._refuse_duplicates(recheck, instance=instance, scope=cls.duplicate_scope(merged))
            for key in changed:
                setattr(instance, key, values[key])
            instance.updated_by = _actor_or_none(actor)
            cls.before_save(instance, creating=False)
            instance.save()
            cls._event(records.MasterdataRecordUpdated, instance, actor, changed=changed)
        return instance

    @classmethod
    def _current(cls, instance) -> dict[str, Any]:
        return {f: getattr(instance, f) for f in ("code", "name", *cls.extra_fields)}

    @classmethod
    def scope_keys(cls, changed: Sequence[str]) -> tuple[str, ...]:
        """Uniqueness fields to re-check when a scoping field (entity type) changed."""
        return ()

    @classmethod
    def archive(cls, *, actor, instance: CatalogT) -> CatalogT:
        with transaction.atomic():
            instance = cls._lock(instance)
            refuse_system_row(instance)
            if instance.status == CatalogStatus.ARCHIVED:
                return instance
            instance.status = CatalogStatus.ARCHIVED
            instance.updated_by = _actor_or_none(actor)
            instance.save()
            cls._event(records.MasterdataRecordArchived, instance, actor)
        return instance

    @classmethod
    def restore(cls, *, actor, instance: CatalogT) -> CatalogT:
        """Undelete a soft-deleted row, or un-archive an archived one."""
        with transaction.atomic():
            instance = cls._lock(instance, include_deleted=True)
            if not instance.is_deleted and instance.status == CatalogStatus.ACTIVE:
                return instance
            if instance.is_deleted:
                cls._refuse_duplicates(
                    {"code": instance.code, "name": instance.name},
                    instance=instance,
                    scope=cls.duplicate_scope(cls._current(instance)),
                )
                SoftDeleteService.restore(instance)
            else:
                instance.status = CatalogStatus.ACTIVE
            cls.before_restore(instance)
            instance.updated_by = _actor_or_none(actor)
            instance.save()
            cls._event(records.MasterdataRecordRestored, instance, actor)
        return instance

    @classmethod
    def before_restore(cls, instance) -> None:
        """Refuse a restore that would break a rule (statuses: second default)."""

    @classmethod
    def soft_delete(cls, *, actor, instance: CatalogT) -> None:
        with transaction.atomic():
            instance = cls._lock(instance)
            refuse_system_row(instance)
            refuse_dependants(instance)
            SoftDeleteService.delete(instance, user=_actor_or_none(actor))
            cls._event(records.MasterdataRecordDeleted, instance, actor, cascade=[])

    @classmethod
    def hard_delete(cls, *, actor, instance: CatalogT) -> None:
        with transaction.atomic():
            instance = cls._lock(instance, include_deleted=True)
            refuse_system_row(instance)
            if not instance.is_deleted:
                raise MasterdataConflict(
                    "Only a soft-deleted record can be permanently deleted.",
                    code="not_soft_deleted",
                )
            refuse_dependants(instance, include_deleted=True)
            snapshot = {
                "code": instance.code,
                "name": instance.name,
                "label": instance._meta.label,
                "id": str(instance.pk),
            }
            SoftDeleteService.hard_delete(instance)
            records.MasterdataRecordHardDeleted.dispatch(
                model=snapshot["label"],
                id=snapshot["id"],
                code=snapshot["code"],
                name=snapshot["name"],
                actor_id=str(actor.pk) if _actor_or_none(actor) else None,
            )

    @classmethod
    def reorder(cls, *, actor, ordered_ids: Sequence[UUID | str]) -> list[CatalogT]:
        ids = [str(i) for i in ordered_ids]
        if len(set(ids)) != len(ids):
            raise ValidationError({"ids": ["Duplicate ids."]})
        with transaction.atomic():
            rows = {str(r.pk): r for r in cls.model.objects.select_for_update().filter(pk__in=ids)}
            missing = [i for i in ids if i not in rows]
            if missing:
                raise ValidationError(
                    {"ids": [f"Unknown or deleted ids: {', '.join(missing[:5])}."]}
                )
            ordered = []
            for position, pk in enumerate(ids, start=1):
                row = rows[pk]
                setattr(row, cls.order_field, position * 10)
                row.updated_by = _actor_or_none(actor)
                ordered.append(row)
            cls.model.objects.bulk_update(ordered, [cls.order_field, "updated_by"])
            for row in ordered:
                cls._event(records.MasterdataRecordUpdated, row, actor, changed=[cls.order_field])
        return ordered


# ---------------------------------------------------------------------------
# Per-type services
# ---------------------------------------------------------------------------


class MasterTaskTypeService(CatalogService[MasterTaskType]):
    model = MasterTaskType
    label = "Task type"
    extra_fields = ("category", "department_code", "department_name", "color", "icon", "sort_order")

    @classmethod
    def clean_extra(cls, name, value):
        if name == "color":
            return v.clean_color(value)
        if name == "sort_order":
            return v.clean_non_negative_int(value, name)
        return v.clean_text(value, name, required=False, max_length=255)


class MasterAssetTypeService(CatalogService[MasterAssetType]):
    model = MasterAssetType
    label = "Asset type"
    extra_fields = ("color", "icon", "sort_order")

    @classmethod
    def clean_extra(cls, name, value):
        if name == "color":
            return v.clean_color(value)
        if name == "sort_order":
            return v.clean_non_negative_int(value, name)
        return v.clean_text(value, name, required=False, max_length=100)


class MasterShotTypeService(CatalogService[MasterShotType]):
    model = MasterShotType
    label = "Shot type"
    extra_fields = ("default_handle_frames", "sort_order")

    @classmethod
    def clean_extra(cls, name, value):
        if name == "default_handle_frames" and value is None:
            return None
        return v.clean_non_negative_int(value, name)


class MasterReviewTypeService(CatalogService[MasterReviewType]):
    model = MasterReviewType
    label = "Review type"
    extra_fields = ("allow_verdicts", "require_notes", "sort_order")

    @classmethod
    def clean_extra(cls, name, value):
        if name == "sort_order":
            return v.clean_non_negative_int(value, name)
        if not isinstance(value, bool):
            raise ValidationError({name: ["Must be true or false."]})
        return value


class MasterFileTypeService(CatalogService[MasterFileType]):
    """File types: ``extension`` is normalized, and ``code`` defaults to it."""

    model = MasterFileType
    label = "File type"
    extra_fields = ("extension", "mime_type", "category", "dcc_affinity", "sort_order")

    @classmethod
    def derive_code(cls, values):
        return str(values.get("extension") or "").strip().lstrip(".").lower()

    @classmethod
    def clean_extra(cls, name, value):
        if name == "extension":
            return v.clean_text(value, name, required=False, max_length=20).lstrip(".").lower()
        if name == "sort_order":
            return v.clean_non_negative_int(value, name)
        return v.clean_text(value, name, required=False, max_length=100)

    @classmethod
    def _refuse_duplicates(cls, values, *, instance=None, scope=None):
        super()._refuse_duplicates(values, instance=instance, scope=scope)
        extension = values.get("extension")
        if extension:
            qs = cls._live().filter(extension__iexact=extension)
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise ValidationError(
                    {"extension": ["A file type with this extension already exists."]}
                )


class MasterStatusService(CatalogService[MasterStatus]):
    model = MasterStatus
    label = "Status"
    order_field = "order"
    extra_fields = ("entity_type", "category", "color", "order", "is_default", "is_final")

    @classmethod
    def clean_extra(cls, name, value):
        if name == "entity_type":
            return v.clean_entity_type(value)
        if name == "category":
            return v.clean_category(value)
        if name == "color":
            return v.clean_color(value)
        if name == "order":
            return v.clean_non_negative_int(value, name)
        if not isinstance(value, bool):
            raise ValidationError({name: ["Must be true or false."]})
        return value

    @classmethod
    def _clean(cls, data, *, instance=None):
        if instance is None and "entity_type" not in data:
            raise ValidationError({"entity_type": ["This field is required."]})
        return super()._clean(data, instance=instance)

    @classmethod
    def duplicate_scope(cls, values):
        return {"entity_type": values["entity_type"]} if values.get("entity_type") else {}

    @classmethod
    def scope_keys(cls, changed):
        # Moving a status to another entity type re-opens the code/name check.
        return ("code", "name") if "entity_type" in changed else ()

    @classmethod
    def before_save(cls, instance, *, creating):
        # Setting a new default clears the old one in the same transaction
        # (DOM-MD-STS-04); the partial unique index decides a concurrent race.
        if instance.is_default and instance.status == CatalogStatus.ACTIVE:
            others = cls.model.objects.filter(entity_type=instance.entity_type, is_default=True)
            if instance.pk:
                others = others.exclude(pk=instance.pk)
            others.update(is_default=False)

    @classmethod
    def before_restore(cls, instance):
        if instance.is_default:
            clash = (
                cls.model.objects.filter(
                    entity_type=instance.entity_type, is_default=True, status=CatalogStatus.ACTIVE
                )
                .exclude(pk=instance.pk)
                .exists()
            )
            if clash:
                raise MasterdataConflict(
                    f"Another default status already exists for {instance.entity_type}.",
                    code="conflict",
                )


SERVICES: dict[str, type[CatalogService[Any]]] = {
    "statuses": MasterStatusService,
    "task-types": MasterTaskTypeService,
    "asset-types": MasterAssetTypeService,
    "shot-types": MasterShotTypeService,
    "review-types": MasterReviewTypeService,
    "file-types": MasterFileTypeService,
}
