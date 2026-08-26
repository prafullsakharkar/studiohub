"""
Base pagination classes.
"""

from __future__ import annotations

from rest_framework.pagination import PageNumberPagination, _positive_int


class BasePagination(PageNumberPagination):
    """
    Base pagination class used across the project.

    Returns the raw DRF envelope (``{count, next, previous, results}``) so
    responses match the frontend API contract with no extra wrapping.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500

    def get_page_size(self, request):
        """
        Accept ``limit`` as an alias for ``page_size`` (mock-layer parity).
        """
        for param in (self.page_size_query_param, "limit"):
            value = request.query_params.get(param)
            if value:
                try:
                    return _positive_int(
                        value,
                        strict=True,
                        cutoff=self.max_page_size,
                    )
                except (KeyError, ValueError):
                    continue

        return self.page_size
