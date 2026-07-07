"""
Base authentication service.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model

User = get_user_model()


class AuthenticationService:
    """
    Base class for authentication services.
    """

    @classmethod
    def get_user(
        cls,
        **lookup,
    ):
        return User.objects.filter(
            **lookup,
        ).first()
