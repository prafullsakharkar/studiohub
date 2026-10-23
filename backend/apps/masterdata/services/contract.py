"""
Client and vendor contract services (docs/masterdata/CONTRACTS.md §4.3).

Lifecycle (stored): Draft -> Active -> Terminated, Draft -> Terminated. ``Expired``
is derived from the end date and never written (DECISIONS: contract lifecycle).
An Expired or Terminated contract is read-only except ``adjust_end_date``, the
audited correction path.

Overlap rule (DECISIONS D8): no two MSAs of one parent overlap, inclusive of
both ends, a null end meaning open-ended. It applies to MSAs that are stored
Active, or Terminated after having been Active (they keep the range they
covered). Enforced here under a lock on the parent for a friendly
``contract_overlap`` error, and by a PostgreSQL exclusion constraint as the
backstop.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.core.api.exceptions.api import NotFoundException
from apps.masterdata.events import records
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import (
    EXCLUSIVE_TYPE,
    EXPIRED,
    Client,
    ClientContract,
    ContractStatus,
    Vendor,
    VendorContract,
)
from apps.masterdata.models.contract import ContractBase
from apps.masterdata.services.catalog import actor_or_none
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.validators import catalog as v
from apps.masterdata.validators import directory as d

CREATE_STATUSES = (ContractStatus.DRAFT, ContractStatus.ACTIVE)


def _fail(field: str, message: str) -> ValidationError:
    return ValidationError({field: [message]})


class ContractService[T: ContractBase](DirectoryService[T]):
    parent_field: str  # pyright: ignore[reportUninitializedInstanceVariable]
    parent_model: type[Client] | type[Vendor]  # pyright: ignore[reportUninitializedInstanceVariable]
    value_field: str  # pyright: ignore[reportUninitializedInstanceVariable]
    required = ("contract_number", "title")
    unique_ci = ("contract_number",)
    event_name_field = "contract_number"  # a document number, not personal data
    event_code_field = None

    # ---- validation ----------------------------------------------------

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "contract_number":
            return v.clean_text(value, name, required=True, max_length=100)
        if name == "title":
            return v.clean_text(value, name, required=True, max_length=255)
        if name == "type":
            return v.clean_text(value, name, required=True, max_length=30)
        if name in ("effective_date", "expiry_date"):
            return d.clean_date(value, name)
        if name == "nda_signed":
            return d.clean_bool(value, name)
        if name == "currency":
            return d.clean_currency(value)
        if name == cls.value_field:
            return d.clean_amount(value, name)
        if name == "document_url":
            return d.clean_url(value, name)
        if name == "status":
            if value not in CREATE_STATUSES:
                raise _fail(name, "A contract is created as Draft or Active.")
            return value
        return v.clean_text(value, name, required=False, max_length=100)

    # ---- parent handling -----------------------------------------------

    @classmethod
    def _lock_row(cls, parent: Any) -> Any:
        try:
            return cls.parent_model.objects.select_for_update().get(pk=parent.pk)
        except cls.parent_model.DoesNotExist:
            raise NotFoundException(f"{cls.parent_field.title()} not found.") from None

    @classmethod
    def lock_parent(cls, parent: Any) -> Any:
        if parent is None:
            raise ValueError(f"A contract needs its {cls.parent_field}.")
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

    # ---- rules ---------------------------------------------------------

    @classmethod
    def _occupies_range(cls, contract: T) -> bool:
        """Does this contract take part in the overlap rule?"""
        if (
            contract.type or ""  # pyright: ignore[reportAttributeAccessIssue]
        ).lower() != EXCLUSIVE_TYPE.lower() or contract.effective_date is None:
            return False
        return contract.status == ContractStatus.ACTIVE or (
            contract.status == ContractStatus.TERMINATED and contract.activated_at is not None
        )

    @classmethod
    def _assert_no_overlap(cls, contract: T) -> None:
        if not cls._occupies_range(contract):
            return
        others = (
            cls.model.objects.filter(**{cls.parent_field: getattr(contract, cls.parent_field)})
            .filter(type__iexact=EXCLUSIVE_TYPE)
            .filter(
                models.Q(status=ContractStatus.ACTIVE)
                | models.Q(status=ContractStatus.TERMINATED, activated_at__isnull=False)
            )
            .exclude(pk=contract.pk)
            .filter(
                models.Q(expiry_date__isnull=True)
                | models.Q(expiry_date__gte=contract.effective_date)
            )
        )
        if contract.expiry_date is not None:  # an open-ended contract reaches every later start
            others = others.filter(effective_date__lte=contract.expiry_date)
        clash = others.first()
        if clash is not None:
            raise MasterdataConflict(
                f"Overlaps MSA {clash.contract_number} "
                f"({clash.effective_date} to {clash.expiry_date or 'open-ended'}).",
                code="contract_overlap",
            )

    @classmethod
    def _check_dates(cls, contract: T) -> None:
        if (
            contract.effective_date
            and contract.expiry_date
            and contract.expiry_date < contract.effective_date
        ):
            raise _fail("expiry_date", "The end date cannot be before the start date.")

    @classmethod
    def _refuse_if_read_only(cls, contract: T) -> None:
        effective = contract.effective_status()
        if effective in (EXPIRED, ContractStatus.TERMINATED):
            raise MasterdataConflict(
                f"A {effective} contract is read-only. Use adjust-end-date to correct its end date.",
                code="invalid_transition",
            )

    # ---- save hooks ----------------------------------------------------

    @classmethod
    def before_save(cls, instance: T, *, creating: bool) -> None:
        cls._lock_row(
            getattr(instance, cls.parent_field)
        )  # serialize with other writers of this parent
        cls._check_dates(instance)
        if instance.status == ContractStatus.ACTIVE:
            if instance.effective_date is None:
                raise _fail("effective_date", "An Active contract needs a start date.")
            if instance.activated_at is None:
                instance.activated_at = timezone.now()
            if (
                not creating
                and instance.expiry_date
                and instance.expiry_date < timezone.localdate()
            ):
                raise _fail(
                    "expiry_date",
                    "An Active contract cannot end in the past. Terminate it, or use adjust-end-date.",
                )
        cls._assert_no_overlap(instance)

    @classmethod
    def before_restore(cls, instance: T) -> None:
        owner = getattr(instance, cls.parent_field)
        if owner.is_deleted:
            raise MasterdataConflict(
                f"The {cls.parent_field} is deleted; restore it first.", code="conflict"
            )
        cls._lock_row(owner)
        cls._assert_no_overlap(instance)

    # ---- operations ----------------------------------------------------

    @classmethod
    def update(cls, *, actor: Any, instance: T, data: Mapping[str, Any]) -> T:
        if "status" in data:
            raise ValueError("Status changes only through activate and terminate.")
        with transaction.atomic():
            cls._refuse_if_read_only(cls._lock(instance))
            return super().update(actor=actor, instance=instance, data=data)

    @classmethod
    def _transition(cls, actor: Any, contract: T, *, require: tuple[str, ...], apply) -> T:
        with transaction.atomic():
            cls._lock_row(getattr(contract, cls.parent_field))
            locked = cls._lock(contract)
            before = locked.effective_status()
            if before not in require:
                raise MasterdataConflict(
                    f"A {before} contract cannot do this.", code="invalid_transition"
                )
            apply(locked)
            locked.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            cls._check_dates(locked)
            cls._assert_no_overlap(locked)
            locked.save()
            cls._event(
                records.ContractTransitioned,
                locked,
                actor,
                transition={"from": before, "to": locked.effective_status()},
            )
        return locked

    @classmethod
    def activate(cls, *, actor: Any, contract: T) -> T:
        """Draft -> Active. Needs a start date; the end date must not already be past."""

        def apply(c: T) -> None:
            if c.effective_date is None:
                raise _fail("effective_date", "An Active contract needs a start date.")
            if c.expiry_date and c.expiry_date < timezone.localdate():
                raise _fail("expiry_date", "The end date is already in the past.")
            c.status = ContractStatus.ACTIVE
            c.activated_at = timezone.now()

        return cls._transition(actor, contract, require=(ContractStatus.DRAFT,), apply=apply)

    @classmethod
    def terminate(cls, *, actor: Any, contract: T) -> T:
        """Draft or Active -> Terminated.

        Terminating an Active contract ends it today (when its end is open or
        later) so the range it really covered is recorded. One that had not
        started yet covered nothing and releases its range.
        """

        def apply(c: T) -> None:
            today = timezone.localdate()
            was_active = c.status == ContractStatus.ACTIVE
            c.status = ContractStatus.TERMINATED
            if not was_active:
                return
            if c.effective_date and c.effective_date > today:
                c.activated_at = None
            elif c.expiry_date is None or c.expiry_date > today:
                c.expiry_date = today

        return cls._transition(
            actor, contract, require=(ContractStatus.DRAFT, ContractStatus.ACTIVE), apply=apply
        )

    @classmethod
    def adjust_end_date(cls, *, actor: Any, contract: T, expiry_date: date | None) -> T:
        """Correct the end date of a contract that is, or was, in force (audited).

        The only way to touch an Expired or Terminated contract. It never revives
        one: for those the new end date must be before today.
        """
        new_end = d.clean_date(expiry_date, "expiry_date")
        today = timezone.localdate()
        with transaction.atomic():
            cls._lock_row(getattr(contract, cls.parent_field))
            locked = cls._lock(contract)
            effective = locked.effective_status()
            if locked.status == ContractStatus.DRAFT or (
                locked.status == ContractStatus.TERMINATED and locked.activated_at is None
            ):
                raise MasterdataConflict(
                    "This contract was never in force; edit it normally.", code="invalid_transition"
                )
            if locked.effective_date and new_end and new_end < locked.effective_date:
                raise _fail("expiry_date", "The end date cannot be before the start date.")
            in_the_past_only = effective in (EXPIRED, ContractStatus.TERMINATED)
            if in_the_past_only and (new_end is None or new_end >= today):
                raise _fail(
                    "expiry_date", "An elapsed or terminated contract must end before today."
                )
            if effective == ContractStatus.ACTIVE and new_end is not None and new_end < today:
                raise _fail(
                    "expiry_date",
                    "An Active contract cannot end in the past. Terminate it instead.",
                )

            old_end = locked.expiry_date
            if old_end == new_end:
                return locked
            locked.expiry_date = new_end
            locked.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            cls._assert_no_overlap(locked)
            locked.save()
            cls._event(
                records.ContractEndDateAdjusted,
                locked,
                actor,
                dates={
                    "from": old_end.isoformat() if old_end else None,
                    "to": new_end.isoformat() if new_end else None,
                },
            )
        return locked


class ClientContractService(ContractService[ClientContract]):
    model = ClientContract
    label = "Client contract"
    parent_field = "client"
    parent_model = Client
    value_field = "value_usd"
    writable = (
        "contract_number",
        "title",
        "type",
        "effective_date",
        "expiry_date",
        "nda_signed",
        "currency",
        "value_usd",
        "document_url",
        "status",
    )


class VendorContractService(ContractService[VendorContract]):
    model = VendorContract
    label = "Vendor contract"
    parent_field = "vendor"
    parent_model = Vendor
    value_field = "total_value_usd"
    writable = (
        "contract_number",
        "title",
        "type",
        "effective_date",
        "expiry_date",
        "nda_signed",
        "currency",
        "total_value_usd",
        "security_tier",
        "status",
    )
