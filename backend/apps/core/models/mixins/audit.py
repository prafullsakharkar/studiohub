"""
Audit model mixin.
"""

from __future__ import annotations

from apps.core.services import AuditService


class AuditMixin:
    """
    Audit helper methods.
    """

    def mark_created(self, user):
        return AuditService.mark_created(self, user)

    def mark_updated(self, user):
        return AuditService.mark_updated(self, user)

    def mark_deleted(self, user):
        return AuditService.mark_deleted(self, user)
