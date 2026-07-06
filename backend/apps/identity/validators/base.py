"""
Base validator for the Identity bounded context.
"""

from __future__ import annotations

from apps.core.validators.base import (
    BaseValidator,
)


class IdentityBaseValidator(
    BaseValidator,
):
    """
    Base validator for all Identity models.

    Used by:
        - User
        - Role
        - Permission
        - Group
        - UserPreference
        - UserSession
        - LoginHistory
    """

    pass
