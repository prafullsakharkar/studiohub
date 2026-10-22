"""Admin mixin for append-only audit ledgers."""

from __future__ import annotations


class ReadOnlyLedgerAdminMixin:
    """Ledger rows are written by services only; the admin is view-only."""

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
