"""
structlog configuration for StudioHub (ADR-0022).

``configure_structlog`` wires structlog-native logging and the stdlib bridge
so both paths render through the same processors and the same final renderer
(JSON in production, human-readable console otherwise). Idempotent: safe to
call from ``CoreConfig.ready()`` and repeatedly in tests.
"""

from __future__ import annotations

import logging
import sys

import structlog

from .processors import (
    add_request_context,
    add_service_context,
    redact_secrets,
)

_installed_handler = None


def _shared_processors(*, with_level_filter=True):
    # stdlib records arriving via the foreign_pre_chain have logger=None
    # (already level-filtered by logging itself), so only the
    # structlog-native chain may use filter_by_level.
    level_filter = [structlog.stdlib.filter_by_level] if with_level_filter else []

    return [
        structlog.contextvars.merge_contextvars,
        *level_filter,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        add_service_context,
        add_request_context,
        redact_secrets,
    ]


def _final_renderer(json_output):
    if json_output:
        return structlog.processors.JSONRenderer()

    return structlog.dev.ConsoleRenderer(colors=False)


def configure_structlog(*, json_output=None, level=None):
    """
    Configure structlog + the stdlib bridge.

    ``json_output=None`` selects JSON when Django ``DEBUG`` is off, unless
    overridden by the ``LOG_FORMAT`` environment variable (``json`` /
    ``console`` / empty for automatic). ``level=None`` selects the root
    log level from ``LOG_LEVEL`` (default ``INFO``).

    Returns the final renderer used (handy for tests).
    """

    if json_output is None:
        json_output = _resolve_json_output()

    if level is None:
        level = _resolve_level()

    structlog.configure(
        processors=[
            *_shared_processors(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=_shared_processors(with_level_filter=False),
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            _final_renderer(json_output),
        ],
    )

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()

    global _installed_handler

    if _installed_handler is not None:
        root_logger.removeHandler(_installed_handler)

    _installed_handler = handler
    root_logger.addHandler(handler)

    if root_logger.level > level:
        root_logger.setLevel(level)

    # Silence Django's per-4xx one-liners ("Unauthorized: ...",
    # "Not Found: ..."). They duplicate the structured diagnostic +
    # completion records without adding root-cause detail. 5xx tracebacks
    # still pass through at ERROR.
    logging.getLogger("django.request").setLevel(max(level, logging.ERROR))

    return formatter


def _resolve_json_output() -> bool:
    try:
        from config.env import settings as env_settings

        log_format = str(getattr(env_settings, "log_format", "") or "")
    except Exception:
        log_format = ""

    normalized = log_format.strip().lower()

    if normalized == "json":
        return True

    if normalized == "console":
        return False

    try:
        from django.conf import settings

        return not settings.DEBUG
    except Exception:
        return True


def _resolve_level() -> int:
    try:
        from config.env import settings as env_settings

        configured = str(getattr(env_settings, "log_level", "") or "")
    except Exception:
        configured = ""

    return logging._nameToLevel.get(configured.strip().upper(), logging.INFO)
