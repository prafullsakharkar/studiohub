"""
API response mixin.
"""

from __future__ import annotations

from rest_framework.response import Response

from apps.core.api.builders import ResponseBuilder


class ResponseMixin:
    """
    Standard API responses.
    """

    def success_response(
        self,
        *,
        data=None,
        message="Success.",
        status_code=200,
        meta=None,
    ):
        return Response(
            ResponseBuilder.success(
                data=data,
                message=message,
                status_code=status_code,
                meta=meta,
            ),
            status=status_code,
        )

    def error_response(
        self,
        *,
        message="Request failed.",
        status_code=400,
        errors=None,
        meta=None,
    ):
        return Response(
            ResponseBuilder.error(
                message=message,
                status_code=status_code,
                errors=errors,
                meta=meta,
            ),
            status=status_code,
        )
