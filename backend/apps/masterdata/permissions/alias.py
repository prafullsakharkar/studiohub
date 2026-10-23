"""
HasPermission that still honours the legacy masterdata grant (D9).

``HasPermission`` requires every code in a ``permission_map`` entry, which
cannot express "new code OR legacy code". On a first denial this retries once
with each aliased code swapped for its legacy equivalent, so roles that only
hold ``platform.master_data.configure`` keep working until the alias is
removed. Codes without an alias (``masterdata.hard_delete``) must still be
held as-is, and scoped credentials are narrowed by the same checks.
"""

from __future__ import annotations

from apps.identity.permissions import HasPermission
from apps.masterdata.constants.permissions import LEGACY_ALIASES


class _LegacyCodesView:
    """Presents a view with its required codes swapped for legacy ones."""

    def __init__(self, view, required: tuple[str, ...]) -> None:
        self._view = view
        self._required = required

    def get_permission_required(self):
        return self._required

    def __getattr__(self, name):
        return getattr(self._view, name)


class AliasAwareHasPermission(HasPermission):
    def has_permission(self, request, view):  # pyright: ignore[reportIncompatibleMethodOverride]
        if super().has_permission(request, view):
            return True

        required = view.get_permission_required()
        if not required:
            return False

        legacy = tuple(str(LEGACY_ALIASES.get(code, code)) for code in required)
        if legacy == tuple(required):
            return False

        return super().has_permission(request, _LegacyCodesView(view, legacy))  # pyright: ignore[reportArgumentType]
