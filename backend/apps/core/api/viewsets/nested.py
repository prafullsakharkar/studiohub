"""
Nested ViewSets.
"""

from __future__ import annotations

from .generic import BaseModelViewSet


class NestedModelViewSet(
    BaseModelViewSet,
):
    """
    Parent ViewSet for nested routes.
    """

    parent_lookup_kwarg = None
