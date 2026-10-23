"""
Software and software-version services (docs/masterdata/CONTRACTS.md §3.4).

Software owns its versions: archiving archives them (unless the caller opts
out), soft-deleting soft-deletes them with the *same* timestamp, and
restoring restores exactly the versions that were deleted with it. A hard
delete is refused while any version row still exists (``on_delete=PROTECT``).
"""

from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.utils import timezone

from apps.core.api.exceptions.api import NotFoundException
from apps.masterdata.events import records
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import CatalogStatus, Software, SoftwareVersion
from apps.masterdata.services.catalog import CatalogService, actor_or_none
from apps.masterdata.services.lifecycle import refuse_dependants, refuse_system_row
from apps.masterdata.validators import catalog as v

_URL = URLValidator(schemes=["http", "https"])


class SoftwareService(CatalogService[Software]):
    model = Software
    label = "Software"
    extra_fields = ("publisher", "category", "website", "sort_order")

    @classmethod
    def clean_extra(cls, name, value):
        if name == "sort_order":
            return v.clean_non_negative_int(value, name)
        if name == "website":
            value = v.clean_text(value, name, required=False, max_length=200)
            if value:
                try:
                    _URL(value)
                except ValidationError:
                    raise ValidationError({name: ["Enter a valid http(s) URL."]}) from None
            return value
        return v.clean_text(value, name, required=False, max_length=255)

    # ---- archive: cascades to active versions ---------------------------

    @classmethod
    def archive(cls, *, actor, instance: Software, cascade: bool = True) -> Software:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Archive the software and, by default, its active versions.

        With ``cascade=False`` an active version blocks the archive (409
        ``has_dependants``). The ids archived along are kept on
        ``instance.versions_archived`` for the API response.
        """
        with transaction.atomic():
            instance = cls._lock(instance)
            refuse_system_row(instance)
            instance.versions_archived = []  # pyright: ignore[reportAttributeAccessIssue]
            if instance.status == CatalogStatus.ARCHIVED:
                return instance
            active = SoftwareVersion.objects.filter(software=instance, status=CatalogStatus.ACTIVE)
            version_ids = [str(pk) for pk in active.values_list("pk", flat=True)]
            if version_ids and not cascade:
                raise MasterdataConflict(
                    f"{len(version_ids)} active version(s) still belong to this software.",
                    code="has_dependants",
                )
            who = actor_or_none(actor)
            active.update(status=CatalogStatus.ARCHIVED, updated_by=who)
            instance.status = CatalogStatus.ARCHIVED
            instance.updated_by = who
            instance.save()
            instance.versions_archived = version_ids  # pyright: ignore[reportAttributeAccessIssue]
            cls._event(records.MasterdataRecordArchived, instance, actor, cascade=version_ids)
        return instance

    # ---- delete / restore: versions travel with the software ------------

    @classmethod
    def soft_delete(cls, *, actor, instance: Software) -> None:
        with transaction.atomic():
            instance = cls._lock(instance)
            refuse_system_row(instance)
            who = actor_or_none(actor)
            now = timezone.now()
            live = SoftwareVersion.objects.filter(software=instance)
            version_ids = [str(pk) for pk in live.values_list("pk", flat=True)]
            live.update(is_deleted=True, deleted_at=now, deleted_by=who)
            refuse_dependants(instance)  # anything other than the versions just deleted
            instance.is_deleted = True
            instance.deleted_at = now
            instance.deleted_by = who
            instance.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
            cls._event(records.MasterdataRecordDeleted, instance, actor, cascade=version_ids)

    @classmethod
    def after_undelete(cls, instance: Software, deleted_at) -> list[str]:
        """Bring back only the versions deleted at the same moment as the software."""
        together = SoftwareVersion.all_objects.filter(
            software=instance, is_deleted=True, deleted_at=deleted_at
        )
        ids = [str(pk) for pk in together.values_list("pk", flat=True)]
        together.update(is_deleted=False, deleted_at=None, deleted_by=None)
        return ids


class SoftwareVersionService(CatalogService[SoftwareVersion]):
    model = SoftwareVersion
    label = "Software version"
    extra_fields = ("version", "version_code", "release_date", "end_of_support", "sort_order")
    unique_fields = ("code", "name", "version")

    @classmethod
    def lock_parent(cls, parent: Software | None):
        if parent is None:
            raise ValueError("A software version needs its software.")
        try:
            return Software.objects.select_for_update().get(pk=parent.pk)
        except Software.DoesNotExist:
            raise NotFoundException("Software not found.") from None

    @classmethod
    def prepare_create(cls, data: Mapping[str, Any], parent: Software | None):
        if parent is None:
            raise ValueError("A software version needs its software.")
        version = str(data.get("version") or "").strip()
        filled = dict(data)
        # Callers rarely send these: derive them from the software and version.
        if not str(filled.get("code") or "").strip() and version:
            filled["code"] = f"{parent.code}-{version}"
        if not str(filled.get("name") or "").strip() and version:
            filled["name"] = f"{parent.name} {version}"
        return filled, {"software": parent}

    @classmethod
    def _clean(cls, data, *, instance=None):
        if instance is None and not str(data.get("version") or "").strip():
            raise ValidationError({"version": ["This field is required."]})
        return super()._clean(data, instance=instance)

    @classmethod
    def clean_extra(cls, name, value):
        if name == "sort_order":
            return v.clean_non_negative_int(value, name)
        if name in ("release_date", "end_of_support"):
            if value is None:
                return None
            if isinstance(value, datetime.datetime) or not isinstance(value, datetime.date):
                raise ValidationError({name: ["Enter a valid date."]})
            return value
        return v.clean_text(
            value, name, required=name == "version", max_length=50 if name == "version" else 100
        )

    @classmethod
    def duplicate_scope(cls, values):
        software = values.get("software")
        return {"software": software} if software is not None else {}

    @classmethod
    def _current(cls, instance):
        return {**super()._current(instance), "software": instance.software}

    @classmethod
    def before_save(cls, instance, *, creating):
        release, support = instance.release_date, instance.end_of_support
        if release and support and support < release:
            raise ValidationError(
                {"end_of_support": ["End of support cannot be before the release date."]}
            )
