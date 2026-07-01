"""
Logging context.
"""

from __future__ import annotations

from contextvars import ContextVar

request_id = ContextVar(
    "request_id",
    default=None,
)

organization = ContextVar(
    "organization",
    default=None,
)

user = ContextVar(
    "user",
    default=None,
)
