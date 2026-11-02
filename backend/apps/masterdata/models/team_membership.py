"""
Team membership: a person belongs to a team (CR-32).

A person can be in several teams, so membership is its own link rather than a column on the person.
``Person.team`` stays as the person's primary team; setting it makes sure a membership exists.
The link is plain on purpose (no role, no dates).
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import PlatformScopedModel


class TeamMembership(PlatformScopedModel):
    # PROTECT: a team with members cannot be hard-deleted; a soft delete is refused while live
    # memberships remain (``refuse_dependants``).
    team = models.ForeignKey(
        "masterdata.Team",
        on_delete=models.PROTECT,
        related_name="memberships",
        db_index=True,
    )
    # CASCADE: removing a person for good removes their memberships (the person service deletes the
    # soft-deleted ones first, so the dependants check does not refuse).
    person = models.ForeignKey(
        "masterdata.Person",
        on_delete=models.CASCADE,
        related_name="memberships",
        db_index=True,
    )

    class Meta:
        db_table = "masterdata_team_membership"
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["team"]),
            models.Index(fields=["person"]),
        ]
        constraints = [
            # A person is a member of a team once among the live rows.
            models.UniqueConstraint(
                fields=["team", "person"],
                condition=models.Q(is_deleted=False),
                name="masterdata_teammembership_uq_team_person",
            ),
        ]

    def __str__(self):
        # The person's name is personal data: identify the row by ids only.
        return f"Membership {self.pk} (team {self.team_id}, person {self.person_id})"  # pyright: ignore[reportAttributeAccessIssue]
