from __future__ import annotations

from typing import Any

from django.utils import timezone

from .constants import HTTP_ERROR_CODES


class ResponseBuilder:
    """
    Builds all API response payloads.

    This is the single source of truth for the API response contract.
    """

    @classmethod
    def _meta(
        cls,
        *,
        request=None,
        meta: dict | None = None,
    ) -> dict:
        payload = {
            "request_id": getattr(request, "request_id", None),
            "timestamp": timezone.now().isoformat(),
        }

        if meta:
            payload.update(meta)

        return payload

    @classmethod
    def success(
        cls,
        *,
        status_code: int = 200,
        request=None,
        message: str = "",
        data: Any = None,
        meta: dict | None = None,
    ) -> dict:
        return {
            "success": True,
            "status_code": status_code,
            "message": message,
            "error_code": None,
            "data": data,
            "errors": None,
            "meta": cls._meta(
                request=request,
                meta=meta,
            ),
        }

    @classmethod
    def error(
        cls,
        *,
        status_code: int,
        request=None,
        message: str,
        errors: Any = None,
        meta: dict | None = None,
    ) -> dict:
        return {
            "success": False,
            "status_code": status_code,
            "message": message,
            "error_code": HTTP_ERROR_CODES.get(
                status_code,
                "UNKNOWN_ERROR",
            ),
            "data": None,
            "errors": errors,
            "meta": cls._meta(
                request=request,
                meta=meta,
            ),
        }

    @classmethod
    def paginated(
        cls,
        *,
        request=None,
        status_code: int = 200,
        message: str = "",
        data=None,
        count: int,
        page: int,
        page_size: int,
        total_pages: int,
        next_url,
        previous_url,
    ) -> dict:
        return cls.success(
            status_code=status_code,
            request=request,
            message=message,
            data=data,
            meta={
                "count": count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "next": next_url,
                "previous": previous_url,
            },
        )
