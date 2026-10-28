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

        response.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        )

        # JSON and file responses are data, never a page: nothing in them may load or run anything.
        # HTML (the debug toolbar, Swagger UI in development) keeps working without a policy.
        if not response.get("Content-Type", "").startswith("text/html"):
            response.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )

        return response
