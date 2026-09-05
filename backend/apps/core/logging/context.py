"""
Logging context.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any

request_id: ContextVar[str | None] = ContextVar(
    "request_id",
    default=None,
)

organization: ContextVar[Any | None] = ContextVar(
    "organization",
    default=None,
)

user: ContextVar[Any | None] = ContextVar(
    "user",
    default=None,
)
