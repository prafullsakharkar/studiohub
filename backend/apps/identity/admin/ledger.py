"""Admin mixin for models that only services may write (ledgers, security state)."""

from __future__ import annotations


class ReadOnlyLedgerAdminMixin:
    """
    Rows are written by services only; the admin is view-only.

    Used for append-only ledgers and for security state (MFA, backup codes,
    trusted devices, sessions, API keys, PATs): changing those from the admin
    would bypass the validation, audit events and revocation the services do.
    """

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
