"""
Global DRF exception handler with structured diagnostics (ADR-0031).

Response contract (unchanged):
  Raw DRF error bodies (``{"detail": ...}`` / field-error maps /
  ``{"non_field_errors": [...]}``) with no envelope, matching the frontend
  API contract (``ApiError.fromDrfResponse``).

Additive diagnostics (contract-safe — the frontend parser ignores
object-valued keys):
  Every error body gains ``"error": {"code", "request_id"}`` so clients can
  correlate failures with backend logs. Every failure also emits one
  structured log record (WARNING for 4xx, ERROR with traceback for 5xx)
  sharing the same ``request_id`` as the request lifecycle middleware's
  ``request_completed`` record.
"""

from __future__ import annotations

import contextlib
import logging
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    MethodNotAllowed,
    NotAuthenticated,
    NotFound,
    ParseError,
    PermissionDenied,
    Throttled,
    UnsupportedMediaType,
)
from rest_framework.exceptions import (
    ValidationError as DRFValidationError,
)
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler

from apps.core.api.diagnostics import events
from apps.core.api.diagnostics.context import build_request_context
from apps.core.api.diagnostics.reasons import (
    allowed_methods,
    classify_auth_failure,
    denied_permission_classes,
    error_code_for,
    sanitize_validation_errors,
)
from apps.core.exceptions.base import BaseDomainException
from apps.core.logging.logger import get_logger

_logger = get_logger("api")
_fallback_logger = logging.getLogger(__name__)

_UNSET = object()


def custom_exception_handler(exc, context):
    """
    Standardize all DRF exception responses and emit diagnostics.

    Diagnostics failures never break the response: the translation below
    runs first and any diagnostics error falls back to a stdlib warning.
    """

    request = _context_request(context)
    view = _context_view(context)

    try:
        diagnostics = _diagnose(exc, request, view)
    except Exception:
        diagnostics = {}

    response = _translate(exc, context, request)

    try:
        status_code = int(response.status_code or 500)
    except Exception:
        status_code = 500

    code = error_code_for(exc, status_code)
    diagnostics["code"] = code
    diagnostics["status_code"] = status_code

    try:
        _attach_diagnostics(response, request, diagnostics)
    except Exception:
        _fallback_logger.warning(
            "diagnostics_attach_failed",
            exc_info=True,
        )

    try:
        _log_diagnostic(exc, response, diagnostics)
    except Exception:
        _fallback_logger.warning(
            "diagnostics_log_failed",
            exc_info=True,
        )

    return response


def _context_request(context: Any) -> Any:
    try:
        if isinstance(context, dict):
            return context.get("request")
    except Exception:
        pass

    return None


def _context_view(context: Any) -> Any:
    try:
        if isinstance(context, dict):
            return context.get("view")
    except Exception:
        pass

    return None


def _diagnose(exc: BaseException, request: Any, view: Any) -> dict[str, Any]:
    """
    Build the diagnostic record: base request context plus failure detail.
    """

    action = getattr(view, "action", None)
    diagnostics = build_request_context(
        request, view=view, action=action
    )
    diagnostics["exception_type"] = type(exc).__name__

    _sync_identity_context(request)

    if _is_authentication_failure(exc, request):
        diagnostics["event"] = events.AUTHENTICATION_FAILED
        diagnostics.update(classify_auth_failure(exc, request))
    elif isinstance(exc, PermissionDenied):
        diagnostics["event"] = events.PERMISSION_DENIED
        diagnostics["permission_classes"] = denied_permission_classes(
            view, request
        )
        diagnostics["reason"] = "missing_required_permission"
        diagnostics["detail"] = _safe_detail(exc)
    elif isinstance(exc, MethodNotAllowed):
        diagnostics["event"] = events.METHOD_NOT_ALLOWED
        diagnostics["requested_method"] = diagnostics.get("method")
        diagnostics["allowed_methods"] = allowed_methods(view)
    elif isinstance(exc, NotFound):
        diagnostics["event"] = events.NOT_FOUND
    elif isinstance(exc, (DRFValidationError, DjangoValidationError)):
        diagnostics["event"] = events.VALIDATION_ERROR
        diagnostics["serializer"] = _serializer_name(view)
        diagnostics.update(
            sanitize_validation_errors(_validation_detail(exc))
        )
    elif isinstance(exc, ParseError):
        diagnostics["event"] = events.VALIDATION_ERROR
        diagnostics["reason"] = "malformed_body"
        diagnostics["detail"] = _safe_detail(exc)
    elif isinstance(exc, UnsupportedMediaType):
        diagnostics["event"] = events.VALIDATION_ERROR
        diagnostics["reason"] = "unsupported_media_type"
        diagnostics["detail"] = _safe_detail(exc)
    elif isinstance(exc, Throttled):
        diagnostics["event"] = events.THROTTLED
        diagnostics["throttle_scope"] = getattr(view, "throttle_scope", None)
        diagnostics["wait_seconds"] = getattr(exc, "wait", None)
    elif isinstance(exc, IntegrityError):
        diagnostics["event"] = events.DATABASE_ERROR
        diagnostics["operation"] = diagnostics.get("view_action")
        diagnostics["model"] = _view_model(view)
        diagnostics["exception_message"] = _safe_message(exc)
    elif isinstance(exc, BaseDomainException):
        diagnostics["event"] = _domain_event(exc)
        diagnostics["domain_code"] = getattr(exc, "code", None)
    else:
        diagnostics["event"] = events.UNHANDLED_EXCEPTION
        diagnostics["exception_message"] = _safe_message(exc)

    return diagnostics


def _is_authentication_failure(exc: BaseException, request: Any) -> bool:
    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        return True

    if isinstance(exc, PermissionDenied):
        try:
            user = getattr(request, "user", None)
            if user is None or not user.is_authenticated:
                return True

            raw = getattr(request, "_request", None)
            raw_user = getattr(raw, "user", None)
            if raw_user is None or not raw_user.is_authenticated:
                return True
        except Exception:
            return True

    return False


def _sync_identity_context(request: Any) -> None:
    """
    Publish the DRF-resolved identity for subsequent log records.

    The request lifecycle middleware only sees the pre-authentication
    Django request; enriching the ContextVars here lets its completion
    record carry the actor on failure paths too.
    """

    try:
        from apps.core.logging import context as log_context

        user = getattr(request, "user", None)
        if user is not None and bool(
            getattr(user, "is_authenticated", False)
        ):
            log_context.user.set(user)

        organization = getattr(request, "organization", None) or getattr(
            request, "membership", None
        )
        if organization is not None:
            log_context.organization.set(organization)
    except Exception:
        pass


def _serializer_name(view: Any) -> str | None:
    try:
        serializer_class = view.get_serializer_class()
        return getattr(serializer_class, "__name__", None)
    except Exception:
        return None


def _view_model(view: Any) -> str | None:
    try:
        queryset = getattr(view, "queryset", None)
        model = getattr(queryset, "model", None)
        return getattr(model, "__name__", None)
    except Exception:
        return None


def _validation_detail(exc: BaseException) -> Any:
    if isinstance(exc, DjangoValidationError):
        try:
            return as_serializer_error(exc)
        except Exception:
            return getattr(exc, "message_dict", None) or getattr(
                exc, "messages", [str(exc)]
            )

    return getattr(exc, "detail", None)


def _domain_event(exc: BaseDomainException) -> str:
    try:
        status_code = int(exc.status_code)
    except Exception:
        return events.UNHANDLED_EXCEPTION

    return {
        400: events.VALIDATION_ERROR,
        401: events.AUTHENTICATION_FAILED,
        403: events.PERMISSION_DENIED,
        404: events.NOT_FOUND,
        409: events.DATABASE_ERROR,
        429: events.THROTTLED,
    }.get(status_code, events.UNHANDLED_EXCEPTION)


def _safe_detail(exc: BaseException) -> str | None:
    try:
        detail = getattr(exc, "detail", None) or str(exc)
        return str(detail)[:500]
    except Exception:
        return None


def _safe_message(exc: BaseException) -> str | None:
    try:
        return str(exc)[:500] or None
    except Exception:
        return None


def _translate(exc: BaseException, context: Any, request: Any) -> Response:
    """
    Map exceptions to responses. Statuses and body shapes are frozen by
    the frontend API contract — change only with a contract review.
    """

    if isinstance(exc, BaseDomainException):
        return Response(
            {"detail": exc.message},
            status=exc.status_code,
        )

    # Service-layer validators raise Django's ValidationError, which DRF
    # does not handle — without this mapping every business-rule failure
    # would surface as a 500 instead of a 400.
    if isinstance(exc, DjangoValidationError):
        return Response(
            as_serializer_error(exc),
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Database-level uniqueness/ integrity races that slip past
    # validators are conflicts (409), not server errors (500).
    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "Resource conflict: the request conflicts with existing data."},
            status=status.HTTP_409_CONFLICT,
        )

    response = exception_handler(exc, context)

    if response is None:
        return Response(
            {"detail": "Internal server error."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # DRF coerces ``AuthenticationFailed``/``NotAuthenticated`` to 403 when
    # the view cannot issue a WWW-Authenticate header (e.g. login views
    # without authenticators), and views without authenticators raise
    # ``PermissionDenied`` instead of ``NotAuthenticated``. The API contract
    # treats authentication failures as 401.
    if isinstance(
        exc,
        (AuthenticationFailed, NotAuthenticated),
    ) and response.status_code == status.HTTP_403_FORBIDDEN:
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif (
        isinstance(exc, PermissionDenied)
        and response.status_code == status.HTTP_403_FORBIDDEN
    ):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            response.status_code = status.HTTP_401_UNAUTHORIZED

    return response


def _attach_diagnostics(
    response: Response,
    request: Any,
    diagnostics: dict[str, Any],
) -> None:
    """
    Attach the additive ``error`` envelope and request-id header.

    ``{"error": {"code", "request_id"}}`` is an object value, which the
    frontend error parser ignores — message derivation from ``detail``
    and field-error maps is therefore unchanged.
    """

    request_id = diagnostics.get("request_id") or _ensure_request_id(
        request
    )

    data = getattr(response, "data", None)
    if isinstance(data, dict):
        data["error"] = {
            "code": diagnostics.get("code", "internal_server_error"),
            "request_id": request_id,
        }

    if request_id:
        with contextlib.suppress(Exception):
            response["X-Request-ID"] = request_id


def _ensure_request_id(request: Any) -> str | None:
    """
    Fall back to a generated id (also stored on the request so the
    ``X-Request-ID`` response header agrees with the body).
    """

    try:
        from uuid import uuid4

        from apps.core.api.diagnostics.context import sanitize_request_id

        existing = sanitize_request_id(getattr(request, "request_id", None))
        if existing:
            return existing

        generated = str(uuid4())

        for target in (request, getattr(request, "_request", None)):
            if target is None:
                continue

            with contextlib.suppress(Exception):
                target.request_id = generated

        return generated
    except Exception:
        return None


def _log_diagnostic(
    exc: BaseException,
    response: Response,
    diagnostics: dict[str, Any],
) -> None:
    try:
        status_code = int(diagnostics.get("status_code") or 500)
    except Exception:
        status_code = 500

    fields = dict(diagnostics)
    event = fields.pop("event", events.UNHANDLED_EXCEPTION)

    if status_code >= 500:
        _logger.error(event, exc_info=exc, **fields)
    else:
        _logger.warning(event, **fields)
