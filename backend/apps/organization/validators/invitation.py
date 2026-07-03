from __future__ import annotations

from apps.organization.validators.base import (
    OrganizationBaseValidator,
)


class InvitationValidator(OrganizationBaseValidator):
    """
    Invitation validator.
    """

    @classmethod
    def validate_accept(
        cls,
        instance,
    ):
        return

    @classmethod
    def validate_decline(
        cls,
        instance,
    ):
        return

    @classmethod
    def validate_cancel(
        cls,
        instance,
    ):
        return

    @classmethod
    def validate_expire(
        cls,
        instance,
    ):
        return

    @classmethod
    def validate_resend(
        cls,
        instance,
    ):
        return
