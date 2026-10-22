"""
Shared HTTP error mapping for the MFA endpoints.

A wrong code on an *authenticated* MFA call is a bad request, not an
authentication failure: answering 401 would make a client throw away a
perfectly good session. Lockouts (429) and permission errors pass through.
"""

from __future__ import annotations

from contextlib import contextmanager

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api.builders.response import ResponseBuilder
from apps.identity.authentication.exceptions import MFACodeInvalid


@contextmanager
def mfa_http_errors():
    try:
        yield
    except MFACodeInvalid as exc:
        raise ValidationError({"detail": exc.detail}) from None
    except DjangoValidationError as exc:
        raise ValidationError({"detail": exc.messages}) from None


def ok(*, data=None, message: str = "Success."):
    """Envelope response in the shape ``ResponseBuilder`` defines."""
    return Response(ResponseBuilder.success(data=data, message=message))


def bad_request(message: str):
    return Response(
        ResponseBuilder.error(message=message, status_code=400),
        status=status.HTTP_400_BAD_REQUEST,
    )
