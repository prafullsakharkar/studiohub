"""
Logging middleware integration.
"""

from . import context


class LoggingContextMiddleware:
    """
    Populate logging context variables.
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

        context.request_id.set(
            getattr(
                request,
                "request_id",
                None,
            )
        )

        context.organization.set(
            getattr(
                request,
                "organization",
                None,
            )
        )

        context.user.set(
            getattr(
                request,
                "user",
                None,
            )
        )

        return self.get_response(request)
