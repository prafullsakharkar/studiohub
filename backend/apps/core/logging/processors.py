"""
structlog processors for StudioHub structured logging (ADR-0022).

Processors are pure functions ``(logger, method_name, event_dict)`` so they
are usable both in the structlog chain and in the stdlib foreign_pre_chain.
"""

from __future__ import annotations

import os
from typing import Any

from .constants import REDACTED, SENSITIVE_KEYS, SERVICE_NAME
from .context import (
    request_id as _ctx_request_id,
)
from .context import (
    user as _ctx_user,
)
from .redaction import redact_database_detail


def add_service_context(
    logger: Any,
    method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Attach service name and environment to every event.
    """

    event_dict.setdefault("service", SERVICE_NAME)
    event_dict.setdefault(
        "environment",
        os.environ.get("STUDIOHUB_ENV", "development"),
    )

    return event_dict


def add_request_context(
    logger: Any,
    method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Attach request/user context from ContextVars.

    Model-like objects are reduced to their ids so logs stay small and
    JSON-serializable.
    """

    event_dict.setdefault(
        "request_id",
        _ctx_request_id.get(None),
    )
    event_dict.setdefault(
        "user_id",
        _compact_id(_ctx_user.get(None)),
    )

    return event_dict


def _compact_id(value: Any) -> Any:
    if value is None:
        return None

    return getattr(value, "id", value)


def redact_secrets(
    logger: Any,
    method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Replace sensitive values with a redaction marker.

    Applies to top-level keys and one level of nested mappings (e.g. a
    ``payload`` dict), matching key names case-insensitively.
    """

    for key in list(event_dict.keys()):
        if key.lower() in SENSITIVE_KEYS:
            event_dict[key] = REDACTED
        elif isinstance(event_dict[key], dict):
            event_dict[key] = _redact_mapping(event_dict[key])

    return event_dict


def _redact_mapping(mapping: dict[str, Any]) -> dict[str, Any]:
    return {
        key: REDACTED if key.lower() in SENSITIVE_KEYS else value for key, value in mapping.items()
    }


def redact_database_detail_processor(
    logger: Any,
    method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Strip row values from database error text in the event, a rendered
    traceback (``exception``) and ``exc_info`` strings.

    Runs after ``format_exc_info`` so tracebacks are already strings.
    """

    for key in ("event", "exception", "exception_message", "stack"):
        value = event_dict.get(key)
        if isinstance(value, str) and (
            "DETAIL:" in value or "Key (" in value or "Failing row" in value
        ):
            event_dict[key] = redact_database_detail(value)

    return event_dict
