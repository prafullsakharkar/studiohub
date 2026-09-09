"""
List serializers.
"""

from __future__ import annotations

from typing import Any

from rest_framework.serializers import ListSerializer


class BaseListSerializer(ListSerializer[Any]):
    """
    Base list serializer.
    """

    pass
