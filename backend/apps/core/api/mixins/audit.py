"""
Audit mixin.
"""

from __future__ import annotations


class AuditMixin:
    """
    Automatically populate audit fields.
    """

    def perform_create(
        self,
        serializer,
    ):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(
        self,
        serializer,
    ):
        serializer.save(
            updated_by=self.request.user,
        )
