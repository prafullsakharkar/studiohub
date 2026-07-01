"""
Limit/offset pagination.
"""

from __future__ import annotations

from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response

from apps.core.api.builders import (
    PaginationBuilder,
    ResponseBuilder,
)


class StandardLimitOffsetPagination(
    LimitOffsetPagination,
):
    """
    Standard limit-offset pagination.
    """

    default_limit = 25
    max_limit = 500

    def get_paginated_response(self, data):
        page_size = self.limit or self.default_limit

        current_page = (self.offset // page_size) + 1 if page_size else 1

        total_pages = (self.count + page_size - 1) // page_size if page_size else 1

        pagination = PaginationBuilder.build(
            page=current_page,
            page_size=page_size,
            total=self.count,
            pages=total_pages,
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
