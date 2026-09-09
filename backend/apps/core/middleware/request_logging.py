"""
Request lifecycle logging middleware (ADR-0031).

Outermost middleware: emits exactly one ``request_completed`` record per
request (INFO for 2xx/3xx, WARNING for 4xx, ERROR for 5xx) plus a single
``unhandled_exception`` record — with full traceback — for exceptions that
escape the view layer. Diagnostic detail for failures is emitted by the
centralized DRF exception handler under the same ``request_id``.

Deliberately a plain new-style middleware (not ``BaseMiddleware``): it
needs exception visibility, which ``BaseMiddleware.__call__`` does not
provide. It never swallows exceptions and never touches the database.
"""

from __future__ import annotations

import time
from typing import Any

from apps.core.api.diagnostics import events
from apps.core.logging.logger import get_logger

_logger = get_logger("api")

_suspicious_names = frozenset(
    {
        "DisallowedHost",
        "DisallowedRedirect",
        "SuspiciousOperation",
        "SuspiciousMultipartForm",
        "SuspiciousFileOperation",
        "RequestDataTooBig",
        "TooManyFieldsSent",
        "TooManyFilesSent",
    }
)


class RequestLoggingMiddleware:
    """
    Time every request and log exactly one completion record.

    Place first in ``MIDDLEWARE`` so the completion record is emitted even
    when an inner middleware or the view raises.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from apps.core.api.diagnostics.context import (
            build_request_context,
            ensure_request_id,
        )

        request.request_id = ensure_request_id(request)
        started = time.perf_counter()

        try:
            response = self.get_response(request)
        except Exception as exc:
            if _is_django_handled(exc):
                # Http404 / SuspiciousOperation: Django converts these to
                # 4xx responses with its own logging; re-raise untouched to
                # avoid duplicate diagnostics.
                raise

            context = _safe_context(build_request_context, request)
            context["duration_ms"] = _duration_ms(started)

            _logger.exception(events.UNHANDLED_EXCEPTION, exc_info=exc, **context)
            raise

        context = _safe_context(build_request_context, request)
        context["duration_ms"] = _duration_ms(started)

        try:
            status_code = int(getattr(response, "status_code", 0) or 0)
        except Exception:
            status_code = 0

        context["status_code"] = status_code

        if status_code >= 500:
            _logger.error(events.REQUEST_COMPLETED, **context)
        elif status_code >= 400:
            _logger.warning(events.REQUEST_COMPLETED, **context)
        else:
            _logger.info(events.REQUEST_COMPLETED, **context)

        return response


def _is_django_handled(exc: BaseException) -> bool:
    if type(exc).__name__ == "Http404":
        return True

    return (
        type(exc).__module__.startswith("django.")
        and type(exc).__name__ in _suspicious_names
    )


def _duration_ms(started: float) -> float:
    try:
        return round((time.perf_counter() - started) * 1000, 2)
    except Exception:
        return -1.0


def _safe_context(builder: Any, request: Any) -> dict[str, Any]:
    try:
        context = builder(request)
        if isinstance(context, dict):
            return context
    except Exception:
        pass

    return {}
