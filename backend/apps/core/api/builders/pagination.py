"""
Pagination Builder.
"""

from __future__ import annotations

from typing import Any


class PaginationBuilder:
    """
    Build standardized pagination metadata.
    """

    @staticmethod
    def build(
        *,
        page: int,
        page_size: int,
        total: int,
        pages: int,
        next_url: str | None,
        previous_url: str | None,
    ) -> dict[str, Any]:
        """
        Build pagination payload.
        """
        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": pages,
            "next": next_url,
            "previous": previous_url,
        }
