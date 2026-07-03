"""
Team write service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.organization.events import (
    TeamActivated,
    TeamArchived,
    TeamCreated,
    TeamDeactivated,
    TeamDeleted,
    TeamLeadAssigned,
    TeamMoved,
    TeamRestored,
    TeamUpdated,
)
from apps.organization.models import Team
from apps.organization.validators.team import TeamValidator


class TeamService(BusinessService):
    """
    Handles all write operations for Team.
    """

    model = Team

    validator_class = TeamValidator

    event_map = {
        "create": TeamCreated,
        "update": TeamUpdated,
        "delete": TeamDeleted,
        "restore": TeamRestored,
        "activate": TeamActivated,
        "deactivate": TeamDeactivated,
        "archive": TeamArchived,
        "assign_lead": TeamLeadAssigned,
        "move": TeamMoved,
    }

    @classmethod
    @transaction.atomic
    def assign_lead(
        cls,
        instance,
        lead,
    ):
        """
        Assign team lead.
        """

        cls.validator_class.validate_assign_lead(
            instance,
            lead,
        )

        instance.lead = lead

        instance.save(
            update_fields=[
                "lead",
            ]
        )

        cls.publish_event(
            "assign_lead",
            instance=instance,
            lead=lead,
        )

        return instance

    @classmethod
    @transaction.atomic
    def move(
        cls,
        instance,
        department,
    ):
        """
        Move team to another department.
        """

        cls.validator_class.validate_move(
            instance,
            department,
        )

        instance.department = department

        instance.save(
            update_fields=[
                "department",
            ]
        )

        cls.publish_event(
            "move",
            instance=instance,
            department=department,
        )

        return instance
