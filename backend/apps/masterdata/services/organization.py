"""
Department, team, office and position services (docs/masterdata/CONTRACTS.md §5.1 to §5.4).

Every write goes through ``DirectoryService`` (validate, one transaction, event after
commit). What these add: references must point at live rows, hierarchies stay acyclic and
at most ``MAX_DEPTH`` levels, one live headquarters. A soft delete is refused while any
live row still points at the record (``refuse_dependants``): child departments, teams,
positions, people, and the records other apps keep, such as assets and resources.
"""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError

from apps.core.models.bases import PlatformScopedModel
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Department, DepartmentType, Office, Person, Position, Team
from apps.masterdata.services import hierarchy
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.validators import catalog as v
from apps.masterdata.validators import directory as d


def live_ref(model: type[Any], value: Any, field: str, *, required: bool = False) -> Any:
    """Return the live ``model`` row for an instance or pk, ``None`` if allowed and absent."""
    if value is None or value == "":
        if required:
            raise ValidationError({field: ["This field is required."]})
        return None
    pk = getattr(value, "pk", value)
    try:
        row = model.objects.filter(pk=pk).first()
    except (ValidationError, ValueError, TypeError):
        row = None
    if row is None:
        raise ValidationError({field: ["Does not exist or has been deleted."]})
    return row


class _OrganizationService[T: PlatformScopedModel](DirectoryService[T]):
    required = ("code", "name")
    unique_ci = ("code", "name")
    event_name_field = "name"  # organisational units, not personal data
    event_code_field = "code"

    @classmethod
    def clean_common(cls, name: str, value: Any) -> Any:
        if name == "code":
            return v.clean_text(value, name, required=True, max_length=30)
        if name == "name":
            return v.clean_text(value, name, required=True, max_length=255)
        if name == "description":
            return v.clean_text(value, name, required=False, max_length=10_000)
        if name == "color":
            return v.clean_color(value)
        raise ValueError(f"No rule for {name!r}")  # a writable field without a rule is a bug

    @classmethod
    def before_restore(cls, instance: T) -> None:
        """A row cannot come back pointing at a deleted parent, department, manager or lead."""
        for field in instance._meta.concrete_fields:  # pyright: ignore[reportAttributeAccessIssue]
            if not field.is_relation or field.name in ("created_by", "updated_by", "deleted_by"):
                continue
            target = getattr(instance, field.name, None)
            if target is not None and getattr(target, "is_deleted", False):
                raise MasterdataConflict(
                    f"The {field.name.replace('_', ' ')} is deleted; restore it first "
                    "or choose another.",
                    code="conflict",
                )

    @classmethod
    def _parent_changed(cls, instance: T) -> bool:
        """Did the parent of a stored row change (always true for a new one)?"""
        if instance._state.adding:  # pyright: ignore[reportAttributeAccessIssue]
            return True
        stored = cls.model.all_objects.filter(pk=instance.pk).values_list("parent_id", flat=True)  # pyright: ignore[reportAttributeAccessIssue]
        return stored.first() != instance.parent_id  # pyright: ignore[reportAttributeAccessIssue]


class DepartmentService(_OrganizationService[Department]):
    model = Department
    label = "Department"
    required = ("code", "name", "department_type")
    writable = (
        "code",
        "name",
        "description",
        "parent",
        "department_type",
        "manager",
        "color",
        "software_stack",
    )

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "parent":
            return live_ref(Department, value, name)
        if name == "manager":
            return live_ref(Person, value, name)
        if name == "department_type":
            return d.clean_choice(value, name, DepartmentType.values)
        if name == "software_stack":
            return d.clean_str_list(value, name)
        return cls.clean_common(name, value)

    @classmethod
    def serialize_writes(cls) -> None:
        hierarchy.serialize_writes("department")

    @classmethod
    def before_save(cls, instance: Department, *, creating: bool) -> None:
        if cls._parent_changed(instance):
            hierarchy.check_parent(Department, instance, instance.parent, label="department")

    @classmethod
    def move(cls, *, actor: Any, department: Department, new_parent: Department | None):
        """Re-parent a department (``None`` makes it a root)."""
        return cls.update(actor=actor, instance=department, data={"parent": new_parent})


class TeamService(_OrganizationService[Team]):
    model = Team
    label = "Team"
    required = ("code", "name", "department")
    writable = (
        "code",
        "name",
        "description",
        "department",
        "lead",
        "focus_discipline",
        "current_project_code",
        "color",
        "capacity",
    )

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "department":
            return live_ref(Department, value, name, required=True)
        if name == "lead":
            return live_ref(Person, value, name)
        if name == "focus_discipline":
            return v.clean_text(value, name, required=False, max_length=64)
        if name == "current_project_code":
            return v.clean_text(value, name, required=False, max_length=16)
        if name == "capacity":
            return v.clean_non_negative_int(value, name)
        return cls.clean_common(name, value)


class OfficeService(_OrganizationService[Office]):
    model = Office
    label = "Office"
    required = ("code", "name", "office_type", "timezone", "country", "city")
    writable = (
        "code",
        "name",
        "description",
        "office_type",
        "timezone",
        "country",
        "state",
        "city",
        "address",
        "postal_code",
        "phone",
        "email",
        "manager",
        "working_hours",
        "workstations_count",
        "render_nodes_count",
        "is_active",
        "is_headquarters",
    )

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "office_type":
            return v.clean_text(value, name, required=True, max_length=50)
        if name == "timezone":
            return d.clean_timezone(value, name, required=True)
        if name in ("country", "state", "city"):
            return v.clean_text(value, name, required=name != "state", max_length=100)
        if name == "address":
            return v.clean_text(value, name, required=False, max_length=1_000)
        if name == "postal_code":
            return v.clean_text(value, name, required=False, max_length=20)
        if name == "phone":
            return d.clean_phone(value, name, max_length=30)
        if name == "email":
            return d.clean_email(value)
        if name == "manager":
            return live_ref(Person, value, name)
        if name == "working_hours":
            return v.clean_text(value, name, required=False, max_length=32)
        if name in ("workstations_count", "render_nodes_count"):
            return v.clean_non_negative_int(value, name)
        if name in ("is_active", "is_headquarters"):
            return d.clean_bool(value, name)
        return cls.clean_common(name, value)

    @classmethod
    def serialize_writes(cls) -> None:
        hierarchy.serialize_writes("office")

    @classmethod
    def before_save(cls, instance: Office, *, creating: bool) -> None:
        # One live headquarters (DOM-MD-OFF-02): naming a new one demotes the old one.
        if instance.is_headquarters:
            Office.objects.filter(is_headquarters=True).exclude(pk=instance.pk).update(
                is_headquarters=False
            )

    @classmethod
    def before_restore(cls, instance: Office) -> None:
        super().before_restore(instance)
        if (
            instance.is_headquarters
            and Office.objects.filter(is_headquarters=True).exclude(pk=instance.pk).exists()
        ):
            raise MasterdataConflict("Another office is the headquarters.", code="conflict")


class PositionService(_OrganizationService[Position]):
    model = Position
    label = "Position"
    writable = (
        "code",
        "name",
        "description",
        "department",
        "parent",
        "level",
        "is_managerial",
        "band_level",
        "salary_range",
        "employment_type",
    )

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        if name == "department":
            return live_ref(Department, value, name)
        if name == "parent":
            return live_ref(Position, value, name)
        if name == "level":
            level = v.clean_non_negative_int(value, name)
            if level < 1:
                raise ValidationError({name: ["Must be at least 1."]})
            return level
        if name == "is_managerial":
            return d.clean_bool(value, name)
        if name in ("band_level", "salary_range"):
            return v.clean_text(value, name, required=False, max_length=50)
        if name == "employment_type":
            return v.clean_text(value, name, required=False, max_length=30)
        return cls.clean_common(name, value)

    @classmethod
    def serialize_writes(cls) -> None:
        hierarchy.serialize_writes("position")

    @classmethod
    def before_save(cls, instance: Position, *, creating: bool) -> None:
        if cls._parent_changed(instance):
            hierarchy.check_parent(Position, instance, instance.parent, label="position")
