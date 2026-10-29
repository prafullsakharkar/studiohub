"""
Person service (docs/masterdata/CONTRACTS.md §5.5, DECISIONS D4 and "Phase 6 decisions").

Beyond the base operations: the Identity link only changes through ``link_user`` and
``unlink_user``; while linked, ``name`` and ``email`` belong to Identity; setting a person
inactive or archived (or deleting one) clears the department/office manager and team lead
links that name them and reports the affected rows as warnings.
"""

from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.choices.lifecycle import LifecycleStatus
from apps.masterdata.events import records
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Department, Office, Person, Position, Team
from apps.masterdata.services.catalog import actor_or_none
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.services.identity_link import identity_values
from apps.masterdata.services.organization import live_ref
from apps.masterdata.validators import catalog as v
from apps.masterdata.validators import directory as d

#: ``(model, field)`` pairs that name a person as manager or lead.
MANAGER_LINKS = (
    (Department, "manager"),
    (Team, "lead"),
    (Office, "manager"),
)
_OUT_OF_SERVICE = (LifecycleStatus.INACTIVE, LifecycleStatus.ARCHIVED)


class PersonService(DirectoryService[Person]):
    model = Person
    label = "Person"
    required = ("name",)
    unique_ci = ("email",)
    event_name_field = None  # a person's name is personal data
    event_code_field = None
    writable = (
        "name",
        "description",
        "email",
        "phone",
        "date_of_birth",
        "nationality",
        "security_clearance",
        "status",
        "role",
        "department",
        "team",
        "office",
        "seniority",
        "skills",
        "timezone",
        "availability_status",
    )

    # ---- validation ----------------------------------------------------

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "name":
            return v.clean_text(value, name, required=True, max_length=255)
        if name == "description":
            return v.clean_text(value, name, required=False, max_length=10_000)
        if name == "email":
            return d.clean_email(value)
        if name == "phone":
            return d.clean_phone(value, name, max_length=20)
        if name == "date_of_birth":
            born = d.clean_date(value, name)
            if born is not None and not datetime.date(1900, 1, 1) <= born <= timezone.localdate():
                raise ValidationError({name: ["Enter a date between 1900 and today."]})
            return born
        if name == "nationality":
            return v.clean_text(value, name, required=False, max_length=100)
        if name == "security_clearance":
            return v.clean_text(value, name, required=False, max_length=64)
        if name in ("seniority", "availability_status"):
            return v.clean_text(value, name, required=False, max_length=32)
        if name == "timezone":
            return d.clean_timezone(value, name)
        if name == "status":
            return d.clean_choice(value, name, LifecycleStatus.values)
        if name == "skills":
            return d.clean_str_list(value, name)
        if name == "role":
            return live_ref(Position, value, name)
        if name == "department":
            return live_ref(Department, value, name)
        if name == "team":
            return live_ref(Team, value, name)
        if name == "office":
            return live_ref(Office, value, name)
        raise ValueError(f"No rule for {name!r}")

    @classmethod
    def before_save(cls, instance: Person, *, creating: bool) -> None:
        # DOM-MD-PER-06: a team belongs to one department, so the pair must agree.
        team, department = instance.team, instance.department
        if team is not None and department is not None and team.department_id != department.pk:  # pyright: ignore[reportAttributeAccessIssue]
            raise ValidationError({"team": ["This team belongs to a different department."]})

    # ---- manager and lead links ---------------------------------------

    @classmethod
    def _clear_links(cls, person: Person) -> list[dict[str, str]]:
        """Clear every manager/lead field naming ``person``; return what was affected."""
        warnings: list[dict[str, str]] = []
        for model, field in MANAGER_LINKS:
            rows = model.objects.filter(**{field: person})
            for pk in rows.values_list("pk", flat=True):
                warnings.append({"model": model._meta.label, "id": str(pk), "field": field})
            rows.update(**{field: None})
        return warnings

    @classmethod
    def cascade_soft_delete(cls, instance: Person, deleted_at: Any, who: Any) -> list[str]:
        return [w["id"] for w in cls._clear_links(instance)]

    @classmethod
    def before_restore(cls, instance: Person) -> None:
        if (
            instance.user_id  # pyright: ignore[reportAttributeAccessIssue]
            and Person.objects.filter(user_id=instance.user_id).exclude(pk=instance.pk).exists()  # pyright: ignore[reportAttributeAccessIssue]
        ):
            raise MasterdataConflict("Another person is now linked to this user.", code="conflict")
        for field in ("role", "department", "team", "office"):
            target = getattr(instance, field)
            if target is not None and target.is_deleted:
                raise MasterdataConflict(
                    f"The {field} is deleted; restore it first or choose another.",
                    code="conflict",
                )

    # ---- operations ----------------------------------------------------

    @classmethod
    def update(cls, *, actor: Any, instance: Person, data: Mapping[str, Any]) -> Person:
        """Update; if this takes the person out of service, report the links it cleared.

        The result carries ``directory_warnings`` (possibly empty) for the API to return.
        """
        with transaction.atomic():
            current = cls._lock(instance)
            if current.user_id:  # pyright: ignore[reportAttributeAccessIssue]
                for field in ("name", "email"):
                    if field in data and cls.clean_field(field, data[field]) != getattr(
                        current, field
                    ):
                        raise ValidationError(
                            {field: ["Owned by the linked user account; change it there."]}
                        )
            was_in_service = current.status not in _OUT_OF_SERVICE
            person = super().update(actor=actor, instance=instance, data=data)
            warnings: list[dict[str, str]] = []
            if was_in_service and person.status in _OUT_OF_SERVICE:
                warnings = cls._clear_links(person)
                cls._event(
                    records.PersonDeactivated,
                    person,
                    actor,
                    cascade=[w["id"] for w in warnings],
                )
            person.directory_warnings = warnings  # pyright: ignore[reportAttributeAccessIssue]
        return person

    @classmethod
    def warnings(cls, person: Person) -> list[dict[str, str]]:
        """What the last ``update`` / ``deactivate`` of ``person`` cleared (``[]`` if nothing)."""
        return getattr(person, "directory_warnings", [])

    @classmethod
    def deactivate(
        cls, *, actor: Any, person: Person, status: str = LifecycleStatus.INACTIVE
    ) -> Person:
        if status not in _OUT_OF_SERVICE:
            raise ValidationError({"status": ["Use inactive or archived."]})
        return cls.update(actor=actor, instance=person, data={"status": status})

    @classmethod
    def reactivate(cls, *, actor: Any, person: Person) -> Person:
        return cls.update(actor=actor, instance=person, data={"status": LifecycleStatus.ACTIVE})

    @classmethod
    def link_user(cls, *, actor: Any, person: Person, user: Any) -> Person:
        User = get_user_model()
        with transaction.atomic():
            locked = cls._lock(person)
            if locked.user_id:  # pyright: ignore[reportAttributeAccessIssue]
                raise MasterdataConflict("This person is already linked; unlink first.")
            target = User.objects.filter(pk=getattr(user, "pk", user)).first()
            if target is None or not target.is_active:
                raise ValidationError({"user": ["Choose an existing, active user."]})
            # Lock the user so two concurrent links of one user serialize.
            target = User.objects.select_for_update().get(pk=target.pk)
            if Person.objects.filter(user=target).exclude(pk=locked.pk).exists():
                raise MasterdataConflict("This user is already linked to another person.")
            copied = identity_values(target)
            email = copied.get("email")
            if email and Person.objects.filter(email__iexact=email).exclude(pk=locked.pk).exists():
                raise MasterdataConflict("Another person already uses this e-mail address.")
            locked.user = target  # pyright: ignore[reportAttributeAccessIssue]
            for field, value in copied.items():
                setattr(locked, field, value)
            locked.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            locked.save()
            cls._event(records.PersonLinked, locked, actor, fields=["user", *sorted(copied)])
        return locked

    @classmethod
    def unlink_user(cls, *, actor: Any, person: Person) -> Person:
        with transaction.atomic():
            locked = cls._lock(person)
            if not locked.user_id:  # pyright: ignore[reportAttributeAccessIssue]
                raise MasterdataConflict("This person is not linked to a user.")
            locked.user = None  # pyright: ignore[reportAttributeAccessIssue]
            locked.updated_by = actor_or_none(actor)  # pyright: ignore[reportAttributeAccessIssue]
            locked.save()
            cls._event(records.PersonUnlinked, locked, actor)
        return locked
