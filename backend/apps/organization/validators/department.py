"""
Department validator.
"""

from __future__ import annotations

from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class DepartmentValidator(OrganizationBaseValidator):
    """
    Department validator.
    """

    @classmethod
    def validate_assign_manager(
        cls,
        instance,
        manager,
    ):
        return

    @classmethod
    def validate_move(
        cls,
        instance,
        parent,
    ):
        return
