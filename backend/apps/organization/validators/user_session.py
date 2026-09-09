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

    @classmethod
    def validate_refresh(cls, session):
        """Validate session can be refreshed. Accepts active sessions; no-op for now if session exists."""
        if session is None:
            raise ValueError("Session not found for refresh.")

    @classmethod
    def validate_logout(cls, session):
        if session is None:
            raise ValueError("Session not found for logout.")

    @classmethod
    def validate_create(cls, **kwargs):
        return True
