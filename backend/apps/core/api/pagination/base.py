"""
Base pagination classes.
"""

from __future__ import annotations

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.core.api.builders import (
    PaginationBuilder,
    ResponseBuilder,
)


class BasePagination(PageNumberPagination):
    """
    Base pagination class used across the project.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500

    def get_paginated_response(self, data):
        pagination = PaginationBuilder.build(
            page=self.page.number,
            page_size=self.get_page_size(self.request),
            total=self.page.paginator.count,
            pages=self.page.paginator.num_pages,
            next_url=self.get_next_link(),
            previous_url=self.get_previous_link(),
        )

        return Response(
            ResponseBuilder.success(
                data=data,
                meta={
                    "pagination": pagination,
                },
            )
        )
