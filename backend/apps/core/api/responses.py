from rest_framework.response import Response

from .builders import ResponseBuilder


class APIResponse(Response):
    """
    Standard success response.
    """

    def __init__(
        self,
        *,
        data=None,
        message="",
        status=200,
        request=None,
        headers=None,
        content_type=None,
        meta=None,
    ):
        super().__init__(
            data=ResponseBuilder.success(
                status_code=status,
                request=request,
                message=message,
                data=data,
                meta=meta,
            ),
            status=status,
            headers=headers,
            content_type=content_type,
        )
