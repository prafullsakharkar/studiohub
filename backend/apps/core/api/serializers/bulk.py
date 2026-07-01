"""
Bulk serializers.
"""

from __future__ import annotations

from .base import BaseModelSerializer


class BulkModelSerializer(BaseModelSerializer):
    """
    Base serializer for bulk operations.
    """

    class Meta:
        abstract = True
