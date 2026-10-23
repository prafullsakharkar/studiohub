"""
Base service for the directory models (clients, vendors, contacts, contracts).

Like the catalog services (``services/catalog.py``) every write validates, then
runs in one ``transaction.atomic()`` that writes and publishes the domain event
(the bus delivers it after commit). Differences: directory rows have no
``code``-based system flag or status archive, they may belong to a parent that
is locked for the length of a create, and some are personal data, so the audit
event never carries a name for them (``event_name_field = None``).

Errors: ``ValidationError`` (400) for bad input and duplicates found before the
write; ``MasterdataConflict`` (409, specific code) for illegal states; a
unique-constraint race surfaces as ``IntegrityError`` and becomes 409 ``conflict``
in the core handler.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.core.api.exceptions.api import NotFoundException
from apps.core.models.bases import PlatformScopedModel
from apps.core.services.soft_delete import SoftDeleteService
from apps.masterdata.events import records
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.services.catalog import actor_or_none
from apps.masterdata.services.lifecycle import refuse_dependants


class DirectoryService[T: PlatformScopedModel]:
    model: type[T]  # pyright: ignore[reportUninitializedInstanceVariable]
    label: ClassVar[str] = "Record"
    #: Writable fields; ``required`` ones must be present on create.
    writable: ClassVar[tuple[str, ...]] = ()
    required: ClassVar[tuple[str, ...]] = ()
    #: Fields unique ignoring case among live rows (within ``duplicate_scope``).
    unique_ci: ClassVar[tuple[str, ...]] = ()
    #: Attributes shown in the audit event. ``None`` for personal data.
    event_name_field: ClassVar[str | None] = "name"
    event_code_field: ClassVar[str | None] = "code"

    # ---- hooks ---------------------------------------------------------

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        """Validate and normalize one field."""
        return value

    @classmethod
    def duplicate_scope(cls, values: Mapping[str, Any]) -> dict[str, Any]:
        """Extra filter narrowing the uniqueness check (contacts: their parent)."""
        return {}

    @classmethod
    def serialize_writes(cls) -> None:
        """Take any model-wide lock first, before a row lock (lock order: model, then rows).

        Taking it after a row lock can deadlock two writers that each hold a row the other needs.
        """

    @classmethod
    def lock_parent(cls, parent: Any) -> Any:
        """Lock the parent row for the length of a create; return the fresh row."""
        return parent

    @classmethod
    def prepare_create(
        cls, data: Mapping[str, Any], parent: Any
    ) -> tuple[Mapping[str, Any], dict[str, Any]]:
        """Return the data to validate and extra model kwargs (the parent FK)."""
        return data, {}

    @classmethod
    def before_save(cls, instance: T, *, creating: bool) -> None:
        """Last-moment, in-transaction rules (primary contact, overlap check)."""

    @classmethod
    def guard_soft_delete(cls, instance: T) -> None:
        """Refuse a soft delete that would break a rule (partner with active contracts)."""

    @classmethod
    def cascade_soft_delete(cls, instance: T, deleted_at: Any, who: Any) -> list[str]:
        """Soft-delete children with ``deleted_at``; return their ids for the audit event."""
        return []

    @classmethod
    def after_undelete(cls, instance: T, deleted_at: Any) -> list[str]:
        """Restore the children deleted at ``deleted_at``; return their ids."""
        return []

    @classmethod
    def before_restore(cls, instance: T) -> None:
        """Refuse a restore that would break a rule (second primary contact, overlap)."""

    # ---- helpers -------------------------------------------------------

    @classmethod
    def _live(cls):
        return cls.model.objects.all()

    @classmethod
    def _lock(cls, instance: T, *, include_deleted: bool = False) -> T:
        manager = cls.model.all_objects if include_deleted else cls.model.objects
        try:
            return manager.select_for_update().get(pk=instance.pk)
        except cls.model.DoesNotExist:
            raise NotFoundException(f"{cls.label} not found.") from None

    @classmethod
    def _event(cls, event, instance: T, actor: Any, **extra: Any) -> None:
        event.dispatch(
            model=instance._meta.label,
            id=str(instance.pk),
            code=getattr(instance, cls.event_code_field, None) if cls.event_code_field else None,
            name=getattr(instance, cls.event_name_field, None) if cls.event_name_field else None,
            actor_id=str(actor.pk) if actor_or_none(actor) else None,
            **extra,
        )

    @classmethod
    def _clean(cls, data: Mapping[str, Any], *, creating: bool) -> dict[str, Any]:
        unknown = set(data) - set(cls.writable)
        if unknown:
            raise ValueError(f"Unsupported {cls.label} fields: {sorted(unknown)}")
        missing = [f for f in cls.required if creating and not str(data.get(f) or "").strip()]
        if missing:
            raise ValidationError({f: ["This field is required."] for f in missing})
        return {name: cls.clean_field(name, value) for name, value in data.items()}

    @classmethod
    def _refuse_duplicates(
        cls,
        values: Mapping[str, Any],
        *,
        instance: T | None = None,
        scope: Mapping[str, Any] | None = None,
    ) -> None:
        qs = cls._live()
        if instance is not None:
            qs = qs.exclude(pk=instance.pk)
        if scope:
            qs = qs.filter(**scope)
        errors: dict[str, list[str]] = {}
        for field in cls.unique_ci:
            value = values.get(field)
            if value and qs.filter(**{f"{field}__iexact": value}).exists():
                errors[field] = [f"A {cls.label.lower()} with this {field} already exists."]
        if errors:
            raise ValidationError(errors)

    @classmethod
    def _current(cls, instance: T) -> dict[str, Any]:
        return {f: getattr(instance, f) for f in cls.writable if hasattr(instance, f)}

    # ---- operations ----------------------------------------------------

    @classmethod
    def create(cls, *, actor: Any, data: Mapping[str, Any], parent: Any = None) -> T:
        with transaction.atomic():
            cls.serialize_writes()
            parent = cls.lock_parent(parent)
            data, extra = cls.prepare_create(data, parent)
            values = cls._clean(data, creating=True)
            cls._refuse_duplicates(values, scope=cls.duplicate_scope({**values, **extra}))
            instance = cls.model(**values, **extra)
            instance.created_by = instance.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            cls.before_save(instance, creating=True)
            instance.save()
            cls._event(records.MasterdataRecordCreated, instance, actor, fields=sorted(values))
        return instance

    @classmethod
    def update(cls, *, actor: Any, instance: T, data: Mapping[str, Any]) -> T:
        with transaction.atomic():
            cls.serialize_writes()
            instance = cls._lock(instance)
            values = cls._clean(data, creating=False)
            changed = sorted(k for k, val in values.items() if getattr(instance, k) != val)
            if not changed:
                return instance
            merged = {**cls._current(instance), **values}
            recheck = {f: merged[f] for f in cls.unique_ci if f in changed}
            cls._refuse_duplicates(
                recheck,
                instance=instance,
                scope=cls.duplicate_scope({**merged, **cls._scope_of(instance)}),
            )
            for key in changed:
                setattr(instance, key, values[key])
            instance.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            cls.before_save(instance, creating=False)
            instance.save()
            cls._event(records.MasterdataRecordUpdated, instance, actor, changed=changed)
        return instance

    @classmethod
    def _scope_of(cls, instance: T) -> dict[str, Any]:
        """Parent values needed by ``duplicate_scope`` when updating an existing row."""
        return {}

    @classmethod
    def soft_delete(cls, *, actor: Any, instance: T) -> None:
        from django.utils import timezone

        with transaction.atomic():
            instance = cls._lock(instance)
            cls.guard_soft_delete(instance)
            who = actor_or_none(actor)
            now = timezone.now()
            cascade = cls.cascade_soft_delete(instance, now, who)
            refuse_dependants(instance)  # whatever is left, e.g. deliveries pointing at a client
            instance.is_deleted = True  # pyright: ignore[reportAttributeAccessIssue]
            instance.deleted_at = now  # pyright: ignore[reportAttributeAccessIssue]
            instance.deleted_by = who  # pyright: ignore[reportAttributeAccessIssue]
            instance.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
            cls._event(records.MasterdataRecordDeleted, instance, actor, cascade=cascade)

    @classmethod
    def restore(cls, *, actor: Any, instance: T) -> T:
        with transaction.atomic():
            instance = cls._lock(instance, include_deleted=True)
            if not instance.is_deleted:  # pyright: ignore[reportAttributeAccessIssue]
                return instance
            current = cls._current(instance)
            cls._refuse_duplicates(
                {f: current[f] for f in cls.unique_ci},
                instance=instance,
                scope=cls.duplicate_scope({**current, **cls._scope_of(instance)}),
            )
            deleted_at = instance.deleted_at  # pyright: ignore[reportAttributeAccessIssue]
            cls.before_restore(instance)
            SoftDeleteService.restore(instance)
            cascade = cls.after_undelete(instance, deleted_at)
            instance.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            instance.save()
            cls._event(records.MasterdataRecordRestored, instance, actor, cascade=cascade)
        return instance

    @classmethod
    def hard_delete(cls, *, actor: Any, instance: T) -> None:
        with transaction.atomic():
            instance = cls._lock(instance, include_deleted=True)
            if not instance.is_deleted:  # pyright: ignore[reportAttributeAccessIssue]
                raise MasterdataConflict(
                    "Only a soft-deleted record can be permanently deleted.",
                    code="not_soft_deleted",
                )
            refuse_dependants(instance, include_deleted=True)
            snapshot = {
                "model": instance._meta.label,
                "id": str(instance.pk),
                "code": getattr(instance, cls.event_code_field, None)
                if cls.event_code_field
                else None,
                "name": getattr(instance, cls.event_name_field, None)
                if cls.event_name_field
                else None,
            }
            SoftDeleteService.hard_delete(instance)
            records.MasterdataRecordHardDeleted.dispatch(
                **snapshot, actor_id=str(actor.pk) if actor_or_none(actor) else None
            )
