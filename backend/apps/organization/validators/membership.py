from __future__ import annotations

from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class OrganizationMembershipValidator(OrganizationBaseValidator):
    """
    Organization membership validator.
    """

    @classmethod
    def validate_accept(
        cls,
        instance,
    ):
        return

    @classmethod
    def validate_suspend(
        cls,
        instance,
    ):
        return

    @classmethod
    def validate_reactivate(
        cls,
        instance,
    ):
        return
