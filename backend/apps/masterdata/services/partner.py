"""
Client and vendor services (docs/masterdata/CONTRACTS.md §4.1).

A partner owns contacts and contracts: a soft delete is refused while an Active
(not yet elapsed) contract exists, otherwise it takes the partner's contacts and
its other contracts along with one shared timestamp, and a restore brings back
exactly those. A hard delete is refused while any such row exists (PROTECT).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.core.models.bases import PlatformScopedModel
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Client, Vendor
from apps.masterdata.models.contract import active_now_q
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.validators import catalog as v
from apps.masterdata.validators import directory as d


class PartnerService[T: PlatformScopedModel](DirectoryService[T]):
    required = ("name", "code")
    unique_ci = ("code",)
    event_name_field = "name"  # a company name, not personal data
    event_code_field = "code"

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "name":
            return v.clean_text(value, name, required=True, max_length=255)
        if name == "code":
            return v.clean_text(value, name, required=True, max_length=20)
        if name == "email":
            return d.clean_email(value)
        if name == "phone":
            return d.clean_phone(value)
        if name == "logo_url":
            return d.clean_url(value, name)
        if name in ("portal_access", "nda_signed"):
            return d.clean_bool(value, name)
        if name == "status":
            return v.clean_text(value, name, required=False, max_length=30)
        return v.clean_text(value, name, required=False, max_length=cls._max_length(name))

    @classmethod
    def _max_length(cls, name: str) -> int:
        return (
            500
            if name == "bandwidth_link"
            else 100
            if name in ("studio_type", "contract_tier", "specialization", "security_tier")
            else 255
        )

    @classmethod
    def guard_soft_delete(cls, instance: T) -> None:
        from django.utils import timezone

        active = instance.contracts.filter(active_now_q(timezone.localdate())).count()  # pyright: ignore[reportAttributeAccessIssue]
        if active:
            raise MasterdataConflict(
                f"{active} active contract(s) still belong to this {cls.label.lower()}.",
                code="has_dependants",
            )

    @classmethod
    def cascade_soft_delete(cls, instance: T, deleted_at: Any, who: Any) -> list[str]:
        ids: list[str] = []
        for relation in ("contacts", "contracts"):
            rows = getattr(instance, relation).all()  # the default manager: live rows only
            ids += [str(pk) for pk in rows.values_list("pk", flat=True)]
            rows.update(is_deleted=True, deleted_at=deleted_at, deleted_by=who)
        return ids

    @classmethod
    def after_undelete(cls, instance: T, deleted_at: Any) -> list[str]:
        ids: list[str] = []
        for relation in ("contacts", "contracts"):
            field = instance._meta.get_field(relation)
            together = field.related_model.all_objects.filter(  # pyright: ignore[reportAttributeAccessIssue,reportOptionalMemberAccess]
                **{field.field.name: instance, "is_deleted": True, "deleted_at": deleted_at}  # pyright: ignore[reportAttributeAccessIssue]
            )
            ids += [str(pk) for pk in together.values_list("pk", flat=True)]
            together.update(is_deleted=False, deleted_at=None, deleted_by=None)
        return ids


class ClientService(PartnerService[Client]):
    model = Client
    label = "Client"
    writable = (
        "name",
        "code",
        "contact_name",
        "email",
        "phone",
        "studio_type",
        "contract_tier",
        "portal_access",
        "status",
        "logo_url",
        "headquarters",
        "total_billed_usd",
    )

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "total_billed_usd":
            return d.clean_decimal(
                value,
                name,
                minimum=Decimal(0),
                maximum=Decimal("9999999999.99"),
                places=2,
                nullable=True,
            )
        return super().clean_field(name, value)


class VendorService(PartnerService[Vendor]):
    model = Vendor
    label = "Vendor"
    writable = (
        "name",
        "code",
        "contact_name",
        "email",
        "specialization",
        "security_tier",
        "nda_signed",
        "rating",
        "location",
        "status",
        "logo_url",
        "bandwidth_gbps",
        "bandwidth_link",
    )

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "rating":
            return d.clean_decimal(value, name, minimum=Decimal(0), maximum=Decimal(5), places=2)
        if name == "bandwidth_gbps":
            return d.clean_decimal(
                value, name, minimum=Decimal(0), maximum=Decimal("999.99"), places=2
            )
        return super().clean_field(name, value)
