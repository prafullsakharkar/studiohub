"""
Logging context.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.identity.models.user import User

    UserModel = User
else:
    UserModel = Any

request_id: ContextVar[str | None] = ContextVar(
    "request_id",
    default=None,
)

organization: ContextVar[Any | None] = ContextVar(
    "organization",
    default=None,
)

user: ContextVar[UserModel | None] = ContextVar(
    "user",
    default=None,
)


def get_current_user() -> UserModel | None:
    """
    Get the current user from context variables.

    Returns the user set by LoggingContextMiddleware, or None if not available.
    """
    return user.get()
