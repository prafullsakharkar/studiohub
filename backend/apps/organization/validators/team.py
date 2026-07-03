from __future__ import annotations

from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class TeamValidator(OrganizationBaseValidator):
    """
    Team validator.
    """

    @classmethod
    def validate_assign_lead(
        cls,
        instance,
        lead,
    ):
        return

    @classmethod
    def validate_move(
        cls,
        instance,
        department,
    ):
        return
