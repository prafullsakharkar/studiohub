"""
Bulk serializers.
"""

from __future__ import annotations

from typing import Any

from .base import BaseSerializer


class BulkModelSerializer(BaseSerializer[Any]):
    """
    Base serializer for bulk operations.
    """

    class Meta:
        abstract = True
