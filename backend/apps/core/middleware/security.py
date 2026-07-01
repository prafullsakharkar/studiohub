"""
Security middleware.
"""

from .base import BaseMiddleware


class SecurityHeadersMiddleware(BaseMiddleware):

    def process_response(
        self,
        request,
        response,
    ):

        response.setdefault(
            "X-Content-Type-Options",
            "nosniff",
        )

        response.setdefault(
            "X-Frame-Options",
            "DENY",
        )

        response.setdefault(
            "Referrer-Policy",
            "same-origin",
        )

        return response
