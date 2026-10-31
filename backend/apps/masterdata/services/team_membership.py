"""
Team membership service (CR-32, docs/masterdata/CONTRACTS.md §5.6).

A membership is a plain link between a team and a person. The team is the parent: it is locked for
the length of a create, so two simultaneous adds of one person cannot both pass the duplicate check
(the partial unique constraint is the second line of defence). A membership is added or removed, never
edited; removing one is a soft delete, and adding the person again makes a new row.
"""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.core.api.exceptions.api import NotFoundException
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import Person, Team, TeamMembership
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.services.organization import live_ref


class TeamMembershipService(DirectoryService[TeamMembership]):
    model = TeamMembership
    label = "Team membership"
    required = ("person",)
    writable = ("person",)
    event_name_field = None  # the link names a person
    event_code_field = None

    @classmethod
    def clean_field(cls, name: str, value: Any) -> Any:
        return live_ref(Person, value, name, required=True)

    @classmethod
    def lock_parent(cls, parent: Any) -> Any:
        if parent is None:
            raise ValueError("A membership needs its team.")
        try:
            return Team.objects.select_for_update().get(pk=parent.pk)
        except Team.DoesNotExist:
            raise NotFoundException("Team not found.") from None

    @classmethod
    def prepare_create(cls, data: Any, parent: Any):
        return data, {"team": parent}

    @classmethod
    def before_save(cls, instance: TeamMembership, *, creating: bool) -> None:
        if creating and cls._duplicates(instance).exists():
            raise ValidationError({"person": ["This person is already a member of the team."]})

    @classmethod
    def before_restore(cls, instance: TeamMembership) -> None:
        for field in ("team", "person"):
            if getattr(instance, field).is_deleted:
                raise MasterdataConflict(
                    f"The {field} is deleted; restore it first.", code="conflict"
                )
        if cls._duplicates(instance).exists():
            raise MasterdataConflict(
                "This person is already a member of the team.", code="conflict"
            )

    @classmethod
    def _duplicates(cls, instance: TeamMembership):
        rows = TeamMembership.objects.filter(team=instance.team, person=instance.person)
        return rows.exclude(pk=instance.pk) if instance.pk else rows

    @classmethod
    def ensure(cls, *, actor: Any, team: Team, person: Person) -> TeamMembership:
        """The live membership of ``person`` in ``team``; made if missing (the primary team rule)."""
        with transaction.atomic():
            cls.lock_parent(team)
            existing = TeamMembership.objects.filter(team=team, person=person).first()
            if existing is not None:
                return existing
            return cls.create(actor=actor, data={"person": person}, parent=team)
