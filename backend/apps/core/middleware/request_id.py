"""
Request ID middleware.
"""

from uuid import uuid4

from .base import BaseMiddleware


class RequestIDMiddleware(BaseMiddleware):

    HEADER = "X-Request-ID"

    def process_request(self, request):

        request.request_id = request.headers.get(self.HEADER) or str(uuid4())

        return request

    def process_response(
        self,
        request,
        response,
    ):
        response[self.HEADER] = request.request_id

        return response
