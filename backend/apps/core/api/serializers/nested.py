"""
Nested serializers.
"""

from __future__ import annotations

from .base import BaseNestedSerializer


class NestedModelSerializer(BaseNestedSerializer):
    """
    Base serializer for nested representations.
    """

    class Meta:
        abstract = True
