"""
Trailing-slash tolerance middleware.
"""

from __future__ import annotations

from django.urls import Resolver404, resolve

from .base import BaseMiddleware


class TrailingSlashMiddleware(BaseMiddleware):
    """
    Allow API requests to omit the trailing slash without a redirect.

    Django's ``APPEND_SLASH`` only redirects (301), which most HTTP clients
    downgrade non-GET methods to GET on. This resolves the slash-appended
    path *before* dispatch so writes work without an extra round trip, and
    without changing the canonical (slashed) URLs ``reverse()`` produces.
    """

    def process_request(self, request):
        path = request.path_info

        if path.startswith("/api/") and not path.endswith("/"):
            try:
                resolve(f"{path}/")
            except Resolver404:
                pass
            else:
                request.path_info = f"{path}/"
                request.path = f"{request.path}/"

        return request
