"""
Nested serializers.
"""

from __future__ import annotations

from typing import Any

from .base import BaseNestedSerializer


class NestedModelSerializer(BaseNestedSerializer[Any]):
    """
    Base serializer for nested representations.
    """

    class Meta:
        abstract = True
