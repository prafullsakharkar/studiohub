"""
User session validator.
"""

from __future__ import annotations

from apps.organization.validators.base import OrganizationBaseValidator


class UserSessionValidator(OrganizationBaseValidator):
    """Validator for user sessions."""

    def validate(self, value):
        """Validate user session."""
        raise NotImplementedError
