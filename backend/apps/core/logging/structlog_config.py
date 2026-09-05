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


def configure_structlog(*, json_output=None):
    """
    Configure structlog + the stdlib bridge.

    ``json_output=None`` selects JSON when Django ``DEBUG`` is off.
    Returns the final renderer used (handy for tests).
    """

    if json_output is None:
        try:
            from django.conf import settings

            json_output = not settings.DEBUG
        except Exception:
            json_output = True

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

    if root_logger.level > logging.INFO:
        root_logger.setLevel(logging.INFO)

    return formatter
