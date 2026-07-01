"""
Nested serializers.
"""

from __future__ import annotations

from .base import BaseModelSerializer


class NestedModelSerializer(BaseModelSerializer):
    """
    Base serializer for nested representations.
    """

    class Meta:
        abstract = True
