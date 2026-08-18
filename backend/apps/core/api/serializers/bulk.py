"""
Bulk serializers.
"""

from __future__ import annotations

from .base import BaseSerializer


class BulkModelSerializer(BaseSerializer):
    """
    Base serializer for bulk operations.
    """

    class Meta:
        abstract = True
