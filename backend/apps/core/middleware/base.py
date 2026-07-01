"""
Base middleware.
"""

from __future__ import annotations


class BaseMiddleware:
    """
    Base middleware class.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request = self.process_request(request)

        response = self.get_response(request)

        response = self.process_response(
            request,
            response,
        )

        return response

    def process_request(self, request):
        return request

    def process_response(
        self,
        request,
        response,
    ):
        return response
