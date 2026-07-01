"""
Generic ViewSets.
"""

from __future__ import annotations

from rest_framework import mixins

from .base import BaseViewSet


class BaseModelViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    BaseViewSet,
):
    """
    Full CRUD ViewSet.
    """

    pass
