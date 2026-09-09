"""
Request ID middleware.

Guarantees every request carries a ``request_id`` (client-supplied
``X-Request-ID`` when valid, otherwise a generated UUID) and echoes it
back on the response so clients can correlate errors with backend logs.
"""

from .base import BaseMiddleware


class RequestIDMiddleware(BaseMiddleware):

    HEADER = "X-Request-ID"

    def process_request(self, request):
        # Local import: keeps this early-loaded middleware free of the
        # heavier ``apps.core.api`` package import chain.
        from apps.core.api.diagnostics.context import ensure_request_id

        current = getattr(request, "request_id", None)

        if current:
            # A previous component (e.g. RequestLoggingMiddleware) already
            # assigned an id: keep it so every layer agrees on one value.
            from apps.core.api.diagnostics.context import (
                sanitize_request_id,
            )

            request.request_id = (
                sanitize_request_id(current) or ensure_request_id(request)
            )
        else:
            request.request_id = ensure_request_id(request)

        return request

    def process_response(
        self,
        request,
        response,
    ):
        response[self.HEADER] = getattr(
            request,
            "request_id",
            "",
        ) or ""

        return response
