"""
Audit mixin.
"""

from __future__ import annotations

from typing import Any, ClassVar


class AuditMixin:
    """
    Automatically populate audit fields.
    """
    # Mixin contract: provided by the view/serializer this
    # mixin is combined with. Annotations only, no runtime effect.
    request: ClassVar[Any]

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
