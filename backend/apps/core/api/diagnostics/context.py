"""
Request-context snapshots for structured diagnostics.

``build_request_context`` reduces a Django/DRF request (plus optional view
context) to a small JSON-serializable mapping. It never raises, never logs
credentials, and never touches the database — diagnostics must stay
lightweight and must never break error responses.
"""

from __future__ import annotations

from typing import Any

from apps.core.logging import context as log_context
from apps.core.logging.constants import SENSITIVE_KEYS

MAX_REQUEST_ID_LENGTH = 128
MAX_QUERY_PARAMS = 20
MAX_VALUE_LENGTH = 128
MAX_USER_AGENT_LENGTH = 256


def sanitize_request_id(value: Any) -> str | None:
    """
    Normalize a request/correlation id for safe use in logs and headers.

    Strips surrounding whitespace, drops control characters (log-injection
    hardening), and truncates. Returns ``None`` when nothing usable remains.
    """

    if value is None:
        return None

    text = str(value).strip()
    cleaned = "".join(
        character for character in text if character.isprintable()
    ).strip()

    if not cleaned:
        return None

    return cleaned[:MAX_REQUEST_ID_LENGTH]


def ensure_request_id(request: Any) -> str:
    """
    Return the usable request id: explicitly set, then client-supplied
    ``X-Request-ID`` header, otherwise a generated UUID.
    """

    from uuid import uuid4

    direct = sanitize_request_id(getattr(request, "request_id", None))
    if direct:
        return direct

    return sanitize_request_id(_request_id_header(request)) or str(uuid4())


def _request_id_header(request: Any) -> Any:
    try:
        headers = getattr(request, "headers", None)
        if headers is not None:
            value = headers.get("X-Request-ID")
            if value:
                return value

        meta = getattr(request, "META", None) or getattr(
            getattr(request, "_request", None), "META", None
        )
        return (meta or {}).get("HTTP_X_REQUEST_ID")
    except Exception:
        return None


def build_request_context(
    request: Any = None,
    view: Any = None,
    action: str | None = None,
) -> dict[str, Any]:
    """
    Snapshot a request into structured diagnostic fields.

    Accepts a DRF ``Request``, a Django ``HttpRequest``, or ``None``. Every
    lookup is defensive: diagnostics must never raise, even for synthetic
    requests built in unit tests.
    """

    context: dict[str, Any] = {
        "request_id": _request_id(request),
        "method": getattr(request, "method", None),
        "path": getattr(request, "path", None),
    }

    context.update(_resolver_info(request, view=view, action=action))
    context.update(_actor_info(request))
    context.update(_client_info(request))

    return context


def _request_id(request: Any) -> str | None:
    if request is None:
        return log_context.request_id.get(None)

    direct = sanitize_request_id(getattr(request, "request_id", None))
    if direct is not None:
        return direct

    raw = getattr(request, "_request", None)
    if raw is not None:
        nested = sanitize_request_id(getattr(raw, "request_id", None))
        if nested is not None:
            return nested

    return log_context.request_id.get(None)


def _resolver_info(
    request: Any,
    view: Any = None,
    action: str | None = None,
) -> dict[str, Any]:
    """
    Capture Django resolver data: route, url name, view, and viewset action.

    Prefers the explicitly passed view (available in the DRF exception
    handler); otherwise derives the view class from the resolver match.
    """

    info: dict[str, Any] = {
        "route": None,
        "url_name": None,
        "view": None,
        "view_action": action,
        "api_version": None,
    }

    resolver_match = getattr(request, "resolver_match", None)
    if resolver_match is None:
        raw = getattr(request, "_request", None)
        resolver_match = getattr(raw, "resolver_match", None)

    if resolver_match is not None:
        info["route"] = getattr(resolver_match, "route", None)
        info["url_name"] = getattr(resolver_match, "url_name", None)
        info["api_version"] = _api_version(
            getattr(resolver_match, "namespace", "")
        )

    resolved_view = view
    if resolved_view is None and resolver_match is not None:
        func = getattr(resolver_match, "func", None)
        resolved_view = getattr(func, "cls", None) or getattr(
            func, "__name__", None
        )

    if isinstance(resolved_view, str):
        info["view"] = resolved_view
    elif isinstance(resolved_view, type):
        # Resolver matches expose the view *class* (``func.cls``).
        info["view"] = resolved_view.__name__
        if info["view_action"] is None:
            info["view_action"] = getattr(resolved_view, "action", None)
    elif resolved_view is not None:
        # Handler context passes the view *instance*.
        info["view"] = type(resolved_view).__name__
        if info["view_action"] is None:
            info["view_action"] = getattr(resolved_view, "action", None)

    if info["view_action"] is None and resolver_match is not None:
        info["view_action"] = _action_from_match(
            resolver_match, getattr(request, "method", None)
        )

    return info


def _action_from_match(resolver_match: Any, method: Any) -> str | None:
    """
    Derive the ViewSet action from the resolver match's action map.

    DRF's ``ViewSetMixin.as_view`` stores ``{http_method: action}`` on the
    callback as ``func.actions``.
    """

    try:
        actions = getattr(
            getattr(resolver_match, "func", None), "actions", None
        )
        if isinstance(actions, dict) and isinstance(method, str):
            return actions.get(method.lower())
    except Exception:
        return None

    return None


def _api_version(namespace: Any) -> str | None:
    if not isinstance(namespace, str) or not namespace:
        return None

    for part in namespace.split(":"):
        normalized = part.strip().lower()
        if normalized.startswith("v") and normalized[1:].replace(
            ".", ""
        ).isdigit():
            return normalized

    return None


def _actor_info(request: Any) -> dict[str, Any]:
    """
    Capture the authenticated actor without triggering extra queries.

    ``user_id``/``organization_id`` are ids only. ``authenticated`` reflects
    the resolved user; ``auth_scheme`` names the presented credential scheme
    (``Bearer``/``Basic``/...) without ever including the credential itself.
    """

    info: dict[str, Any] = {
        "user_id": None,
        "organization_id": None,
        "authenticated": False,
        "auth_scheme": None,
    }

    user = _resolve_user(request)
    if user is not None:
        try:
            authenticated = bool(user.is_authenticated)
        except Exception:
            authenticated = False

        info["authenticated"] = authenticated
        if authenticated:
            info["user_id"] = _compact_id(user)

    organization = _resolve_organization(request)
    if organization is not None:
        info["organization_id"] = _compact_id(organization)

    info["auth_scheme"] = auth_scheme(request)

    return info


def _resolve_user(request: Any) -> Any:
    for candidate in (
        getattr(request, "user", None),
        getattr(getattr(request, "_request", None), "user", None),
        log_context.user.get(None),
    ):
        if candidate is not None:
            return candidate

    return None


def _resolve_organization(request: Any) -> Any:
    raw = getattr(request, "_request", request)

    for candidate in (
        getattr(request, "organization", None),
        getattr(raw, "organization", None),
        getattr(request, "membership", None),
        getattr(raw, "membership", None),
        log_context.organization.get(None),
    ):
        if candidate is not None:
            return candidate

    return None


def _compact_id(value: Any) -> Any:
    for attribute in ("id", "pk", "uuid"):
        try:
            identifier = getattr(value, attribute, None)
        except Exception:
            continue

        if identifier is not None:
            return str(identifier)

    return str(value) if not isinstance(value, (str, int)) else value


def auth_scheme(request: Any) -> str | None:
    try:
        headers = getattr(request, "headers", None)
        authorization = (
            headers.get("Authorization") if headers is not None else None
        )
        if not authorization:
            meta = getattr(request, "META", None) or getattr(
                getattr(request, "_request", None), "META", None
            )
            authorization = (meta or {}).get("HTTP_AUTHORIZATION", "")

        if not authorization or not isinstance(authorization, str):
            return None

        scheme = authorization.split(None, 1)[0].strip()
        return scheme[:32] or None
    except Exception:
        return None


def _client_info(request: Any) -> dict[str, Any]:
    info: dict[str, Any] = {
        "client_ip": None,
        "user_agent": None,
        "content_type": None,
        "query_params": {},
    }

    try:
        meta = getattr(request, "META", None) or getattr(
            getattr(request, "_request", None), "META", None
        )
        if isinstance(meta, dict):
            forwarded = meta.get("HTTP_X_FORWARDED_FOR", "")
            if forwarded:
                info["client_ip"] = forwarded.split(",")[0].strip()[
                    :MAX_VALUE_LENGTH
                ]
            else:
                remote = meta.get("REMOTE_ADDR")
                info["client_ip"] = (
                    str(remote)[:MAX_VALUE_LENGTH]
                    if remote is not None
                    else None
                )

            user_agent = meta.get("HTTP_USER_AGENT")
            if user_agent:
                info["user_agent"] = str(user_agent)[
                    :MAX_USER_AGENT_LENGTH
                ]

        content_type = getattr(request, "content_type", None)
        if content_type:
            info["content_type"] = str(content_type)[:MAX_VALUE_LENGTH]

        info["query_params"] = _sanitized_query_params(request)
    except Exception:
        pass

    return info


def _sanitized_query_params(request: Any) -> dict[str, Any]:
    """
    Capture query parameters with sensitive keys dropped and values capped.

    Parameter *names* are kept (needed for diagnosis); values are truncated.
    Sensitive parameters (tokens, keys) are omitted entirely.
    """

    params: dict[str, Any] = {}

    try:
        query = getattr(request, "query_params", None)
        if query is None:
            query = getattr(request, "GET", None)
        if query is None:
            raw = getattr(request, "_request", None)
            query = getattr(raw, "GET", None)
        if query is None:
            return params

        items = query.lists() if hasattr(query, "lists") else query.items()

        for index, (key, value) in enumerate(items):
            if index >= MAX_QUERY_PARAMS:
                break

            name = str(key)
            if name.lower() in SENSITIVE_KEYS:
                continue

            if isinstance(value, (list, tuple)):
                params[name] = [
                    str(item)[:MAX_VALUE_LENGTH] for item in value[:5]
                ]
            else:
                params[name] = str(value)[:MAX_VALUE_LENGTH]
    except Exception:
        return {}

    return params
