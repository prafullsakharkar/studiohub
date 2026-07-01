"""
Serializer context mixin.
"""

from __future__ import annotations


class ContextMixin:
    """
    Extend serializer context.
    """

    def get_serializer_context(self):
        context = super().get_serializer_context()

        context.update(
            {
                "request": self.request,
                "view": self,
                "user": self.request.user,
            }
        )

        return context
