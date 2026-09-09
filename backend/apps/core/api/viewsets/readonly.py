"""
Read-only ViewSets.
"""

from __future__ import annotations

from rest_framework import mixins

from .base import BaseViewSet


class ReadOnlyModelViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    BaseViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    Read-only ViewSet.
    """

    pass
