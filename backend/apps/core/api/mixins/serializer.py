"""
Serializer mixin.
"""
from __future__ import annotations


class SerializerMixin:
    """
    Hook for additional serializer handling.
    """

    def get_serializer(self, *args, **kwargs):
        return super().get_serializer(*args, **kwargs)
