"""
API Response Builder.
"""

from __future__ import annotations

from typing import Any


class ResponseBuilder:
    """
    Build standardized API responses.
    """

    @staticmethod
    def success(
        *,
        data: Any = None,
        message: str = "Success.",
        status_code: int = 200,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Build a successful response payload.
        """
        return {
            "success": True,
            "status_code": status_code,
            "message": message,
            "data": data,
            "meta": meta or {},
            "errors": None,
        }

    @staticmethod
    def error(
        *,
        message: str = "Request failed.",
        status_code: int = 400,
        errors: Any = None,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Build an error response payload.
        """
        return {
            "success": False,
            "status_code": status_code,
            "message": message,
            "data": None,
            "meta": meta or {},
            "errors": errors,
        }
