"""
Page number pagination.
"""

from __future__ import annotations

from .base import BasePagination


class StandardPagination(BasePagination):
    """
    Standard page-number pagination.
    """

    page_query_param = "page"
