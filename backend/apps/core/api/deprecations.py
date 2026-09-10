"""
Central registry of deprecated API paths.

StudioHub is consolidating its organization-scoped route trees and auth
namespace (ADR-0032). During the migration window the superseded paths keep
serving requests with unchanged behavior, but they are marked deprecated:

- Runtime: ``Deprecation: true`` and ``Sunset: <HTTP-date>`` response
  headers (RFC 9745 / draft-ietf-httpapi-deprecation-header) applied by
  ``apps.core.middleware.deprecation.DeprecationHeaderMiddleware``.
- Schema: the OpenAPI paths are flagged ``deprecated: true`` via
  ``mark_deprecated_paths`` (drf-spectacular postprocessing hook).

Canonical replacements live in ``docs/api/API_MIGRATION_MATRIX.md``. Remove
an entry from ``DEPRECATED_API_PATHS`` only when its sunset date passes and
the route is deleted.
"""

from __future__ import annotations

import re
from typing import Any

# HTTP-date (RFC 7231) after which deprecated routes may be removed.
API_SUNSET_DATE = "Mon, 01 Mar 2027 00:00:00 GMT"

# Regex patterns for paths that are served only during the deprecation
# window. Each entry documents its canonical replacement.
DEPRECATED_API_PATHS: tuple[tuple[re.Pattern[str], str], ...] = (
    # Flat frontend-contract aliases -> nested /api/organizations/<org>/<resource>/
    (
        re.compile(
            r"^/api/v1/"
            r"(departments|teams|offices|people|positions|invitations"
            r"|work-calendars|work-hours|calendars|holidays"
            r"|roles|groups|permissions|api-keys|pats|clients|vendors)"
            r"(/|$)"
        ),
        "/api/organizations/{organization_id}/<resource>/",
    ),
    # Namespaced organization tree -> nested /api/organizations/<org>/<resource>/
    (
        re.compile(r"^/api/v1/organization/.+"),
        "/api/organizations/{organization_id}/<resource>/",
    ),
    # Identity auth namespace -> /api/v1/auth/*
    (
        re.compile(r"^/api/v1/identity/(login|logout|refresh)/$"),
        "/api/v1/auth/<login|refresh|logout>/",
    ),
)


def deprecation_headers_for_path(path: str) -> dict[str, str] | None:
    """
    Return the deprecation headers for ``path``, or ``None`` if canonical.
    """

    for pattern, _replacement in DEPRECATED_API_PATHS:
        if pattern.match(path):
            return {
                "Deprecation": "true",
                "Sunset": API_SUNSET_DATE,
            }

    return None


_HTTP_METHODS = frozenset(
    {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
)


def mark_deprecated_paths(
    result: dict[str, Any],
    generator: Any,  # noqa: ARG001 - drf-spectacular hook signature
    request: Any,  # noqa: ARG001 - drf-spectacular hook signature
    public: bool,  # noqa: ARG001 - drf-spectacular hook signature
) -> dict[str, Any]:
    """
    drf-spectacular postprocessing hook: flag deprecated paths in the schema.

    OpenAPI marks deprecation per operation, so each HTTP method entry on a
    deprecated path gets ``deprecated: true`` plus an
    ``x-deprecated-replacement`` pointer to the canonical route family.
    """

    for path, path_item in result.get("paths", {}).items():
        replacement = deprecated_replacement_for_path(path)
        if replacement is None:
            continue

        for method, operation in path_item.items():
            if method not in _HTTP_METHODS or not isinstance(operation, dict):
                continue
            operation["deprecated"] = True
            operation["x-deprecated-replacement"] = replacement

    return result


def deprecated_replacement_for_path(path: str) -> str | None:
    """
    Return the documented canonical replacement for ``path``, if deprecated.
    """

    for pattern, replacement in DEPRECATED_API_PATHS:
        if pattern.match(path):
            return replacement

    return None
