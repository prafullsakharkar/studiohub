"""
Serializer context mixin.
"""

from __future__ import annotations

from typing import Any, ClassVar


class ContextMixin:
    """
    Extend serializer context.
    """
    request: ClassVar[Any]

    def get_serializer_context(self):
        context = super().get_serializer_context()  # pyright: ignore[reportAttributeAccessIssue]

        context.update(
            {
                "request": self.request,
                "view": self,
                "user": self.request.user,
            }
        )

        return context
