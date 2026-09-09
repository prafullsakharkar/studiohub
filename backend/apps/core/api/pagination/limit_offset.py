"""
Limit/offset pagination.
"""

from __future__ import annotations

from rest_framework.pagination import LimitOffsetPagination


class StandardLimitOffsetPagination(
    LimitOffsetPagination,
):
    """
    Standard limit-offset pagination.

    Returns the raw DRF envelope (``{count, next, previous, results}``).
    """

    default_limit = 25
    max_limit = 500
