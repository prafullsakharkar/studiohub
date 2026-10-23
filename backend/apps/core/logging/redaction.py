"""
Redaction of query-string values that carry personal data.

Request logs and the ``audit.APIRequest`` table record the query string of
every API call. A search such as ``?search=jane@example.com`` would therefore
put an e-mail address into logs and into the database. Apps register, per URL
path prefix, the parameter *names* whose *values* must not be recorded; the
two recorders call into this module. Parameter names are kept (they are needed
for diagnosis), values become ``REDACTED``.

Core stays domain-neutral: it knows nothing about any app's routes. Apps
register their own at startup (``AppConfig.ready``).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any
from urllib.parse import parse_qsl, urlencode

from apps.core.logging.constants import REDACTED

#: ``path prefix -> lower-case parameter names``
_REGISTRY: dict[str, frozenset[str]] = {}


def register_sensitive_query_params(path_prefix: str, names: Iterable[str]) -> None:
    """Redact ``names`` for every path equal to, or below, ``path_prefix``.

    Registering the same prefix again merges the names. Prefixes match whole
    path segments: ``/api/v1/people`` covers ``/api/v1/people/`` and
    ``/api/v1/people/<id>/`` but not ``/api/v1/peoples``.
    """
    prefix = path_prefix.rstrip("/")
    merged = _REGISTRY.get(prefix, frozenset()) | {n.lower() for n in names}
    _REGISTRY[prefix] = merged


def clear_registry() -> None:
    """Forget every registration (tests only)."""
    _REGISTRY.clear()


def registered_prefixes() -> dict[str, frozenset[str]]:
    return dict(_REGISTRY)


def sensitive_names_for_path(path: str) -> frozenset[str]:
    names: frozenset[str] = frozenset()
    for prefix, registered in _REGISTRY.items():
        if path == prefix or path.startswith(prefix + "/"):
            names |= registered
    return names


def _is_sensitive(name: str, sensitive: frozenset[str]) -> bool:
    # ``email__icontains`` (a django-filter lookup) is the ``email`` parameter.
    return str(name).lower().split("__", 1)[0] in sensitive


def redact_query_params(path: str, params: Mapping[str, Any]) -> dict[str, Any]:
    """Copy of ``params`` with the values of sensitive parameters replaced."""
    sensitive = sensitive_names_for_path(path)
    if not sensitive:
        return dict(params)

    out: dict[str, Any] = {}
    for name, value in params.items():
        if _is_sensitive(name, sensitive):
            out[name] = [REDACTED] * len(value) if isinstance(value, (list, tuple)) else REDACTED
        else:
            out[name] = value
    return out


def redact_full_path(path: str, query_string: str) -> str:
    """``path`` plus ``?query`` with sensitive values replaced.

    Order, repeated parameters and non-sensitive values are preserved. A query
    string that cannot be parsed is dropped on a registered path rather than
    risk recording it.
    """
    if not query_string:
        return path

    sensitive = sensitive_names_for_path(path)
    if not sensitive:
        return f"{path}?{query_string}"

    try:
        pairs = parse_qsl(query_string, keep_blank_values=True, strict_parsing=False)
    except ValueError:
        return f"{path}?{REDACTED}"

    cleaned = [(k, REDACTED if _is_sensitive(k, sensitive) else v) for k, v in pairs]
    return f"{path}?{urlencode(cleaned)}"
