"""
Failure classification for structured diagnostics.

Pure helpers that translate exceptions and request state into stable,
machine-readable ``reason`` codes. They never raise, never log, and never
include credential material — only class names, schemes, and reason codes.
"""

from __future__ import annotations

from typing import Any

from apps.core.api.diagnostics.context import auth_scheme
from apps.core.logging.constants import SENSITIVE_KEYS

# Authentication failure reasons (401).
MISSING_CREDENTIALS = "missing_credentials"
INVALID_TOKEN = "invalid_token"
EXPIRED_TOKEN = "expired_token"
REVOKED_TOKEN = "revoked_token"
MALFORMED_TOKEN = "malformed_token"
UNSUPPORTED_SCHEME = "unsupported_authentication_scheme"
AUTH_BACKEND_ERROR = "authentication_backend_error"

# Authorization failure reasons (403).
MISSING_PERMISSION = "missing_required_permission"

MAX_ERROR_FIELDS = 10
MAX_ERROR_MESSAGES = 5
MAX_MESSAGE_LENGTH = 200

# Body/query field names that indicate presented credentials. Detection
# uses names only — values are never read or logged. Superset of
# SENSITIVE_KEYS: e.g. a ``refresh`` field carries a token.
CREDENTIAL_FIELD_NAMES = frozenset(SENSITIVE_KEYS) | {"refresh"}


def _message_text(exc: BaseException) -> str:
    try:
        return str(exc).lower()
    except Exception:
        return ""


def _has_authorization_header(request: Any) -> bool:
    try:
        headers = getattr(request, "headers", None)
        if headers is not None and headers.get("Authorization"):
            return True

        meta = getattr(request, "META", None) or getattr(
            getattr(request, "_request", None), "META", None
        )
        return bool((meta or {}).get("HTTP_AUTHORIZATION"))
    except Exception:
        return False


def _has_body_credentials(request: Any) -> bool:
    """
    Detect credential material carried in the request body (e.g. refresh
    tokens, passwords) by KEY NAME only — values are never read or logged.
    """

    try:
        data = getattr(request, "data", None)
        if data is None:
            raw = getattr(request, "_request", None)
            data = getattr(raw, "data", None)
        if data is None:
            return False

        keys = data.keys() if hasattr(data, "keys") else []
        return any(
            str(key).lower() in CREDENTIAL_FIELD_NAMES
            for key in list(keys)[:20]
        )
    except Exception:
        return False


def has_credentials(request: Any) -> bool:
    """
    Whether the request presented any credentials: an ``Authorization``
    header or credential-named body/query keys (names only, never values).
    """

    if _has_authorization_header(request):
        return True

    if _has_body_credentials(request):
        return True

    return _has_sensitive_query_keys(request)


def _has_sensitive_query_keys(request: Any) -> bool:
    try:
        query = getattr(request, "query_params", None)
        if query is None:
            query = getattr(request, "GET", None)
        if query is None:
            raw = getattr(request, "_request", None)
            query = getattr(raw, "GET", None)
        if query is None or not hasattr(query, "keys"):
            return False

        return any(
            str(key).lower() in CREDENTIAL_FIELD_NAMES
            for key in list(query.keys())[:20]
        )
    except Exception:
        return False


def attempted_auth_classes(request: Any) -> list[str]:
    """
    Names of the DRF authenticator classes evaluated for this request.

    Empty when authentication never ran (non-DRF requests, unit tests).
    """

    try:
        authenticators = getattr(request, "authenticators", None)
        if not authenticators:
            return []

        return sorted(
            {
                type(authenticator).__name__
                for authenticator in authenticators
            }
        )
    except Exception:
        return []


def classify_auth_failure(
    exc: BaseException,
    request: Any = None,
) -> dict[str, Any]:
    """
    Explain *why* authentication failed (401 diagnostics).

    Returns ``reason``, the attempted ``authentication_classes``, the
    presented ``scheme`` (never the credential), and whether any
    credentials were presented at all.
    """

    from rest_framework.exceptions import AuthenticationFailed

    has_cred = has_credentials(request)
    auth_classes = attempted_auth_classes(request)
    scheme = auth_scheme(request)

    class_name = type(exc).__name__
    message = _message_text(exc)

    if not has_cred and class_name in (
        "NotAuthenticated",
        "PermissionDenied",
    ):
        reason = MISSING_CREDENTIALS
    elif "expir" in message or "Expired" in class_name:
        reason = EXPIRED_TOKEN
    elif (
        "blacklist" in message
        or "revok" in message
        or "Revoked" in class_name
    ):
        reason = REVOKED_TOKEN
    elif (
        "malform" in message
        or "no credentials provided" in message
        or "incorrect padding" in message
        or "invalid segment" in message
        or "could not decode" in message
    ):
        # NOTE: SimpleJWT wraps every token failure in InvalidToken whose
        # default detail ("Given token not valid for any token type") is
        # deliberately NOT matched here — it is the generic wrapper, not
        # evidence of malformation. Undecodable vs. bad-signature tokens
        # are indistinguishable after normalization, both are invalid.
        reason = MALFORMED_TOKEN
    elif (
        "scheme" in message
        or "keyword" in message
        or "Unsupported" in class_name
        or _is_unknown_scheme(scheme)
    ):
        reason = UNSUPPORTED_SCHEME
    elif isinstance(exc, AuthenticationFailed):
        reason = INVALID_TOKEN if has_cred else MISSING_CREDENTIALS
    else:
        reason = AUTH_BACKEND_ERROR if has_cred else MISSING_CREDENTIALS

    return {
        "reason": reason,
        "authentication_classes": auth_classes,
        "auth_scheme": scheme,
        "has_credentials": has_cred,
    }


def _is_unknown_scheme(scheme: Any) -> bool:
    if not isinstance(scheme, str) or not scheme:
        return False

    return scheme.lower() not in ("bearer", "basic")


def denied_permission_classes(view: Any, request: Any) -> list[str]:
    """
    Best-effort identification of the permission classes denying access.

    Re-evaluates ``has_permission`` only (object-level checks need the
    object and stay with the view). Any evaluation error is treated as
    "not denied by this class" — diagnostics must not invent denials.
    """

    denied: list[str] = []

    try:
        permission_classes = getattr(view, "permission_classes", None)
        get_permissions = getattr(view, "get_permissions", None)

        if get_permissions is not None and view is not None:
            try:
                instances = get_permissions()
            except Exception:
                instances = []
        elif isinstance(permission_classes, (list, tuple)):
            instances = _instantiate(permission_classes)
        else:
            return denied

        for instance in instances:
            try:
                allowed = instance.has_permission(request, view)
            except Exception:
                continue

            if not allowed:
                denied.append(type(instance).__name__)
    except Exception:
        return denied

    return sorted(set(denied))


def _instantiate(permission_classes: Any) -> list[Any]:
    instances: list[Any] = []

    for permission_class in permission_classes or []:
        try:
            instances.append(
                permission_class()
                if isinstance(permission_class, type)
                else permission_class
            )
        except Exception:
            continue

    return instances


def allowed_methods(view: Any, response: Any = None) -> list[str]:
    """
    Authoritative allowed-method list for 405 diagnostics.

    Prefers the ``Allow`` header DRF already computed; falls back to the
    view's action map / handler introspection.
    """

    if response is not None:
        try:
            allow = response.get("Allow", "")
            if allow:
                return [
                    method.strip().upper()
                    for method in str(allow).split(",")
                    if method.strip()
                ]
        except Exception:
            pass

    try:
        actions = getattr(
            getattr(view, "func", None), "actions", None
        ) or getattr(view, "actions", None)
        if isinstance(actions, dict) and actions:
            return sorted({method.upper() for method in actions})
    except Exception:
        pass

    methods: list[str] = []

    try:
        candidates = getattr(view, "http_method_names", []) or []
        for name in candidates:
            handler = getattr(view, name, None)
            if callable(handler) and type(handler).__name__ not in (
                "http_method_not_allowed",
            ):
                methods.append(str(name).upper())
    except Exception:
        return methods

    return sorted(set(methods))


def sanitize_validation_errors(detail: Any) -> dict[str, Any]:
    """
    Reduce a DRF ``ValidationError.detail`` to diagnosable, safe fields.

    Keeps field names and server-generated messages (capped); drops values
    for sensitive field names so credentials can never leak through logs.
    """

    summary: dict[str, Any] = {
        "fields": [],
        "error_count": 0,
        "errors": {},
    }

    try:
        normalized = _normalize_detail(detail)
    except Exception:
        return summary

    for field in list(normalized.keys())[:MAX_ERROR_FIELDS]:
        summary["fields"].append(field)

        if str(field).lower() in SENSITIVE_KEYS:
            summary["errors"][field] = ["Invalid value."]
            summary["error_count"] += 1
            continue

        messages: list[str] = []
        for message in normalized[field][:MAX_ERROR_MESSAGES]:
            messages.append(str(message)[:MAX_MESSAGE_LENGTH])

        summary["errors"][field] = messages
        summary["error_count"] += len(messages)

    return summary


def _normalize_detail(detail: Any) -> dict[str, list[Any]]:
    if isinstance(detail, dict):
        normalized: dict[str, list[Any]] = {}
        for key, value in detail.items():
            if isinstance(value, (list, tuple)):
                normalized[str(key)] = list(value)
            else:
                normalized[str(key)] = [value]

        return normalized

    if isinstance(detail, (list, tuple)):
        return {"non_field_errors": list(detail)}

    return {"non_field_errors": [detail]}


def classify_cache_error(exc: BaseException) -> str:
    """
    Classify cache/Redis failures into stable reason codes.
    """

    name = type(exc).__name__
    module = type(exc).__module__ or ""
    message = _message_text(exc)

    if "auth" in name.lower() or "auth" in message and "password" in message:
        return "authentication_failed"

    if "Timeout" in name or "timeout" in message or "timed out" in message:
        return "connection_timeout"

    if (
        "Connection" in name
        or "refused" in message
        or "unavailable" in message
        or "nodename nor servname" in message
        or "temporary failure in name resolution" in message
    ):
        return "connection_refused"

    if "Serial" in name or "pickle" in message or "codec" in message:
        return "serialization_error"

    if isinstance(exc, KeyError):
        return "key_error"

    if "redis" in module.lower() and "busy" in message:
        return "server_busy"

    return "unknown"


def error_code_for(exc: BaseException, status_code: int) -> str:
    """
    Stable snake_case error code for the response envelope.

    Validation failures always code as ``validation_error`` (DRF's generic
    ``invalid`` default carries no diagnostic value); otherwise prefers
    the exception's own ``code``/``default_code`` (DRF and domain
    exceptions carry these); falls back to status-derived codes.
    """

    if _is_validation_error(exc):
        return "validation_error"

    for attribute in ("code", "default_code"):
        try:
            value = getattr(exc, attribute, None)
            if isinstance(value, str) and value:
                return _normalize_code(value)
        except Exception:
            continue

    return _status_code(status_code)


def _is_validation_error(exc: BaseException) -> bool:
    try:
        from django.core.exceptions import (
            ValidationError as DjangoValidationError,
        )
        from rest_framework.exceptions import (
            ValidationError as DRFValidationError,
        )

        return isinstance(exc, (DRFValidationError, DjangoValidationError))
    except Exception:
        return False


def _normalize_code(value: str) -> str:
    return "".join(
        character if character.isalnum() else "_"
        for character in value.strip().lower()
    ).strip("_")


def _status_code(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "authentication_failed",
        403: "permission_denied",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        429: "throttled",
        503: "service_unavailable",
    }.get(status_code, "internal_server_error")
