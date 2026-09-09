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
    organization as _ctx_organization,
)
from .context import (
    request_id as _ctx_request_id,
)
from .context import (
    user as _ctx_user,
)


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
    Attach request/user/organization context from ContextVars.

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
    event_dict.setdefault(
        "organization_id",
        _compact_id(_ctx_organization.get(None)),
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
        key: REDACTED if key.lower() in SENSITIVE_KEYS else value
        for key, value in mapping.items()
    }
