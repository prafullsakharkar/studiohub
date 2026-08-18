"""
Global DRF exception handler.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import exception_handler

from apps.core.api.builders import ResponseBuilder


def custom_exception_handler(exc, context):
    """
    Standardize all DRF exception responses.
    """

    response = exception_handler(exc, context)

    if response is None:
        return Response(
            ResponseBuilder.error(
                message="Internal server error.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                errors=None,
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # DRF coerces ``AuthenticationFailed``/``NotAuthenticated`` to 403 when
    # the view cannot issue a WWW-Authenticate header (e.g. login views
    # without authenticators), and views without authenticators raise
    # ``PermissionDenied`` instead of ``NotAuthenticated``. The API contract
    # treats authentication failures as 401.
    if isinstance(
        exc,
        (AuthenticationFailed, NotAuthenticated),
    ) and response.status_code == status.HTTP_403_FORBIDDEN:
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif (
        isinstance(exc, PermissionDenied)
        and response.status_code == status.HTTP_403_FORBIDDEN
    ):
        request = context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            response.status_code = status.HTTP_401_UNAUTHORIZED

    detail = response.data

    message = "Request failed."

    errors = detail

    if isinstance(detail, dict):

        if "detail" in detail:
            message = str(detail["detail"])

        elif "non_field_errors" in detail:
            message = str(detail["non_field_errors"][0])

        else:
            message = "Validation failed."

    elif isinstance(detail, list):

        message = str(detail[0])

    response.data = ResponseBuilder.error(
        message=message,
        status_code=response.status_code,
        errors=errors,
    )

    return response
