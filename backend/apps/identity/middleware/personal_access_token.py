from __future__ import annotations


class PersonalAccessTokenMiddleware:
    """
    Exposes the authenticated Personal Access Token.
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
            "personal_access_token",
        ):
            request.personal_access_token = None

        response = self.get_response(
            request,
        )

        return response
