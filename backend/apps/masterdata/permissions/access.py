"""
Per-request answers to "may this caller see or set this field?" (H1, D11).

Field gating asks the same question ``HasPermission`` answers for a view
(credential scopes, the superuser break-glass, the permission cache), so it asks
that class instead of re-implementing it. The answer is cached on the request:
one lookup per permission code per request, not one per row or field.
"""

from __future__ import annotations

from typing import Any

from apps.identity.permissions import HasPermission

_CACHE_ATTR = "_masterdata_access"


class _RequiresOne:
    """The smallest object ``HasPermission`` accepts: it names one required code."""

    action = "field_access"

    def __init__(self, code: str) -> None:
        self._code = code

    def get_permission_required(self) -> tuple[str, ...]:
        return (self._code,)


def can(request: Any, code: str) -> bool:
    """Whether ``request``'s caller holds ``code``. ``True`` without a request (internal use)."""
    if request is None:
        return True
    cache: dict[str, bool] = request.__dict__.setdefault(_CACHE_ATTR, {})
    if code not in cache:
        cache[code] = bool(HasPermission().has_permission(request, _RequiresOne(code)))  # pyright: ignore[reportArgumentType]
    return cache[code]
