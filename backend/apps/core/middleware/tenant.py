# middleware/tenant.py
"""
Tenant middleware.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest, HttpResponse


class TenantMiddleware:
    """
    Middleware to handle tenant settings.
    """

    def __init__(self, get_response: callable) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        """
        Handle the request.
        """
        # Set tenant based on request
        return self.get_response(request)
