"""
Cursor pagination.
"""

from __future__ import annotations

from rest_framework.pagination import CursorPagination


class StandardCursorPagination(
    CursorPagination,
):
    """
    Cursor pagination.

    Returns the raw DRF envelope (``{next, previous, results}``).
    """

    page_size = 25
    ordering = "-created_at"
