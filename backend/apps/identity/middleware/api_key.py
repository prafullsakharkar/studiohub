from __future__ import annotations


class APIKeyMiddleware:
    """
    Exposes the authenticated API Key on the request.
    """

    def __init__(
        self,
        get_response,
    ):
        self.get_response = get_response

    def __call__(
        self,
        request,
    ):
        if not hasattr(
            request,
            "api_key",
        ):
            request.api_key = None

        response = self.get_response(
            request,
        )

        return response
