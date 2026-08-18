"""
Base pagination classes for domain-specific pagination.

Provides base pagination classes and domain-specific pagination types.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Optional

from django.core.paginator import Paginator
from rest_framework.pagination import (
    CursorPagination,
    LimitOffsetPagination,
    PageNumberPagination,
)
from rest_framework.response import Response

from apps.core.api.builders import PaginationBuilder, ResponseBuilder

if TYPE_CHECKING:
    from django.http import HttpRequest
    from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class BasePagination(PageNumberPagination):
    """
    Base pagination class used across the project.

    Provides consistent pagination behavior with metadata.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500

    def get_paginated_response(self, data: list[Any]) -> Response:
        """
        Get paginated response.

        Args:
            data: List of serialized objects

        Returns:
            DRF Response with pagination metadata
        """
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
            ),
        )

    def get_page_number(self, request: HttpRequest, paginator: Paginator) -> int:
        """
        Get page number from request.

        Args:
            request: The HTTP request
            paginator: The paginator instance

        Returns:
            Page number
        """
        page_number = request.query_params.get(self.page_query_param, 1)
        if page_number in self.last_page_strings:
            page_number = paginator.num_pages
        return int(page_number)

    def get_page_size(self, request: HttpRequest) -> int:
        """
        Get page size from request.

        Args:
            request: The HTTP request

        Returns:
            Page size
        """
        if self.page_size_query_param:
            try:
                return min(
                    int(request.query_params.get(self.page_size_query_param, self.page_size)),
                    self.max_page_size,
                )
            except (ValueError, TypeError):
                return self.page_size
        return self.page_size

    def get_next_link(self) -> Optional[str]:
        """
        Get next page link.

        Returns:
            Next page URL or None
        """
        if not self.page.has_next():
            return None
        request = self.request
        return request.build_absolute_uri()

    def get_previous_link(self) -> Optional[str]:
        """
        Get previous page link.

        Returns:
            Previous page URL or None
        """
        if not self.page.has_previous():
            return None
        request = self.request
        return request.build_absolute_uri()

    def get_page_context(self) -> dict[str, Any]:
        """
        Get pagination context.

        Returns:
            Dictionary with pagination context
        """
        return {
            "page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "total": self.page.paginator.count,
            "pages": self.page.paginator.num_pages,
            "has_next": self.page.has_next(),
            "has_previous": self.page.has_previous(),
            "next_url": self.get_next_link(),
            "previous_url": self.get_previous_link(),
        }


class InfinitePagination(BasePagination):
    """
    Infinite pagination class.

    Provides infinite scrolling pagination behavior.
    """

    page_size = 20
    max_page_size = 100

    def get_next_link(self) -> Optional[str]:
        """
        Get next page link.

        Returns:
            Next page URL or None
        """
        if not self.page.has_next():
            return None
        request = self.request
        cursor = self.request.query_params.get("cursor")
        if cursor:
            return request.build_absolute_uri(f"?cursor={cursor}")
        return request.build_absolute_uri()

    def get_previous_link(self) -> Optional[str]:
        """
        Get previous page link.

        Returns:
            Previous page URL or None
        """
        if not self.page.has_previous():
            return None
        request = self.request
        cursor = self.request.query_params.get("cursor")
        if cursor:
            return request.build_absolute_uri(f"?cursor={cursor}")
        return request.build_absolute_uri()


class CursorPaginationBase(CursorPagination):
    """
    Base cursor pagination class.

    Provides cursor-based pagination behavior.
    """

    page_size = 20
    cursor_query_param = "cursor"
    ordering = "-created_at"

    def get_page_context(self) -> dict[str, Any]:
        """
        Get pagination context.

        Returns:
            Dictionary with pagination context
        """
        return {
            "page_size": self.page_size,
            "next_cursor": self.get_next_cursor(),
            "previous_cursor": self.get_previous_cursor(),
            "next_url": self.get_next_link(),
            "previous_url": self.get_previous_link(),
        }


class LimitOffsetPaginationBase(LimitOffsetPagination):
    """
    Base limit-offset pagination class.

    Provides limit-offset pagination behavior.
    """

    default_limit = 20
    max_limit = 100

    def get_page_context(self) -> dict[str, Any]:
        """
        Get pagination context.

        Returns:
            Dictionary with pagination context
        """
        return {
            "limit": self.limit,
            "offset": self.offset,
            "total": self.count,
            "has_next": self.offset + self.limit < self.count,
            "has_previous": self.offset > 0,
            "next_url": self.get_next_link(),
            "previous_url": self.get_previous_link(),
        }


class PagePagination(BasePagination):
    """
    Page-based pagination class.

    Provides page-based pagination with metadata.
    """

    page_size = 25
    max_page_size = 100

    def get_page_context(self) -> dict[str, Any]:
        """
        Get pagination context.

        Returns:
            Dictionary with pagination context
        """
        return {
            "page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "total": self.page.paginator.count,
            "pages": self.page.paginator.num_pages,
            "has_next": self.page.has_next(),
            "has_previous": self.page.has_previous(),
            "next_url": self.get_next_link(),
            "previous_url": self.get_previous_link(),
        }


class SmallPagination(BasePagination):
    """
    Small pagination class.

    Provides small page size for lists with many items.
    """

    page_size = 10
    max_page_size = 50


class LargePagination(BasePagination):
    """
    Large pagination class.

    Provides large page size for lists with few items.
    """

    page_size = 100
    max_page_size = 500


class ExportPagination(BasePagination):
    """
    Export pagination class.

    Provides large page size for export operations.
    """

    page_size = 1000
    max_page_size = 10000
