"""
Infinite scroll pagination.
"""

from __future__ import annotations

from .cursor import StandardCursorPagination


class InfinitePagination(
    StandardCursorPagination,
):
    """
    Infinite scrolling pagination.
    """

    page_size = 50
