"""
JWT Claims.
"""

from __future__ import annotations


class AuthenticationClaims:

    @classmethod
    def build(
        cls,
        user,
    ):
        return {
            "user_uuid": str(user.uuid),
            "email": user.email,
            "username": user.username,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        }
