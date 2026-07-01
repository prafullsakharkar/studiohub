"""
Cursor pagination.
"""

from __future__ import annotations

from rest_framework.pagination import CursorPagination
from rest_framework.response import Response

from apps.core.api.builders import ResponseBuilder


class StandardCursorPagination(
    CursorPagination,
):
    """
    Cursor pagination.
    """

    page_size = 25
    ordering = "-created_at"

    def get_paginated_response(self, data):
        return Response(
            ResponseBuilder.success(
                data=data,
                meta={
                    "cursor": {
                        "next": self.get_next_link(),
                        "previous": self.get_previous_link(),
                    }
                },
            )
        )
