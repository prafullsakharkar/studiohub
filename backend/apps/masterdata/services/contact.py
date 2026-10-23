"""
Client and vendor contact services (docs/masterdata/CONTRACTS.md §4.2).

Contacts are personal data: the audit event carries neither their name nor any
value (``event_name_field = None``), only field names.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from apps.core.api.exceptions.api import NotFoundException
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Client, ClientContact, Vendor, VendorContact
from apps.masterdata.models.contact import ContactBase
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.validators import catalog as v
from apps.masterdata.validators import directory as d


class ContactService[T: ContactBase](DirectoryService[T]):
    #: Name of the FK to the owner (``client`` / ``vendor``); set by subclasses.
    parent_field: str  # pyright: ignore[reportUninitializedInstanceVariable]
    parent_model: type[Client] | type[Vendor]  # pyright: ignore[reportUninitializedInstanceVariable]
    required = ("name",)
    unique_ci = ("email",)
    event_name_field = None
    event_code_field = None

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "name":
            return v.clean_text(value, name, required=True, max_length=255)
        if name == "email":
            return d.clean_email(value)
        if name == "phone":
            return d.clean_phone(value)
        if name in ("is_primary", "portal_access"):
            return d.clean_bool(value, name)
        return v.clean_text(value, name, required=False, max_length=255 if name == "role" else 100)

    @classmethod
    def _lock_row(cls, parent: Any) -> Any:
        try:
            return cls.parent_model.objects.select_for_update().get(pk=parent.pk)
        except cls.parent_model.DoesNotExist:
            raise NotFoundException(f"{cls.parent_field.title()} not found.") from None

    @classmethod
    def lock_parent(cls, parent: Any) -> Any:
        if parent is None:
            raise ValueError(f"A contact needs its {cls.parent_field}.")
        return cls._lock_row(parent)

    @classmethod
    def prepare_create(cls, data: Mapping[str, Any], parent: Any):
        return data, {cls.parent_field: parent}

    @classmethod
    def duplicate_scope(cls, values: Mapping[str, Any]) -> dict[str, Any]:
        owner = values.get(cls.parent_field)
        return {cls.parent_field: owner} if owner is not None else {}

    @classmethod
    def _scope_of(cls, instance: T) -> dict[str, Any]:
        return {cls.parent_field: getattr(instance, cls.parent_field)}

    @classmethod
    def before_save(cls, instance: T, *, creating: bool) -> None:
        # One primary contact per owner (DOM-MD-CON-01): making this one primary
        # clears the others under a lock on the owner, so two simultaneous
        # "make primary" calls cannot both win.
        if instance.is_primary:
            owner = getattr(instance, cls.parent_field)
            cls._lock_row(owner)
            cls.model.objects.filter(**{cls.parent_field: owner, "is_primary": True}).exclude(
                pk=instance.pk
            ).update(is_primary=False)

    @classmethod
    def before_restore(cls, instance: T) -> None:
        owner = getattr(instance, cls.parent_field)
        if owner.is_deleted:
            raise MasterdataConflict(
                f"The {cls.parent_field} is deleted; restore it first.", code="conflict"
            )
        if (
            instance.is_primary
            and cls.model.objects.filter(**{cls.parent_field: owner, "is_primary": True})
            .exclude(pk=instance.pk)
            .exists()
        ):
            raise MasterdataConflict(
                f"Another primary contact exists for this {cls.parent_field}.", code="conflict"
            )


class ClientContactService(ContactService[ClientContact]):
    model = ClientContact
    label = "Client contact"
    parent_field = "client"
    parent_model = Client
    writable = ("name", "role", "email", "phone", "timezone", "portal_access", "is_primary")


class VendorContactService(ContactService[VendorContact]):
    model = VendorContact
    label = "Vendor contact"
    parent_field = "vendor"
    parent_model = Vendor
    writable = ("name", "role", "email", "phone", "timezone", "is_primary")
