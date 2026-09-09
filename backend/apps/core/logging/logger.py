"""
Logger factory.

Returns structlog bound loggers. Request/user/organization context is
injected by processors (see apps.core.logging.processors) from
apps.core.logging.context ContextVars, so call sites stay clean.
Keeps a stable get_logger(name) API for callers.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import structlog

from .context import (
    organization as _ctx_organization,
)
from .context import (
    request_id as _ctx_request_id,
)
from .context import (
    user as _ctx_user,
)


class ContextLoggerAdapter(logging.LoggerAdapter):  # pyright: ignore[reportMissingTypeArgument]
    """Attach structured context to log records using the ``extra`` dict.

    The adapter pulls values from ContextVars in apps.core.logging.context
    so logging calls don't need to pass context explicitly.
    """

    def process(self, msg: str, kwargs: Mapping[str, Any]):
        extra = dict(kwargs.get("extra", {}))

        # Pull values from the contextvars; keep None if not set.
        extra.setdefault("request_id", _ctx_request_id.get(None))

        org = _ctx_organization.get(None)
        # Keep small stable representations (id or string) if model-like objects
        extra.setdefault("organization", getattr(org, "id", org))

        user = _ctx_user.get(None)
        extra.setdefault("user", getattr(user, "id", user))

        kwargs = dict(kwargs)
        kwargs["extra"] = extra
        return msg, kwargs


def get_logger(name: str):
    """
    Return a structlog bound logger for the given logger name.

    The legacy ``ContextLoggerAdapter`` path is kept for backward
    compatibility but no longer used by the factory.
    """
    return structlog.get_logger(name)
