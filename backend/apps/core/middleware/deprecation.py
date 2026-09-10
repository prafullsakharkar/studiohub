"""
Deprecation header middleware.
"""

from __future__ import annotations

from apps.core.api.deprecations import deprecation_headers_for_path
from apps.core.middleware.base import BaseMiddleware


class DeprecationHeaderMiddleware(BaseMiddleware):
    """
    Mark deprecated API routes on responses.

    Adds ``Deprecation: true`` and ``Sunset: <HTTP-date>`` headers (RFC 9745
    style) to responses served from paths listed in
    ``apps.core.api.deprecations.DEPRECATED_API_PATHS``. Canonical routes are
    untouched. The registry is the single source of truth for both runtime
    headers and OpenAPI schema deprecation flags.
    """

    def process_response(self, request, response):
        headers = deprecation_headers_for_path(request.path)

        if headers:
            for name, value in headers.items():
                response.setdefault(name, value)

        return response
