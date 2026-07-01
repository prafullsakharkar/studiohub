"""
Organization middleware.
"""

from .base import BaseMiddleware


class OrganizationMiddleware(BaseMiddleware):

    HEADER = "X-Organization"

    def process_request(self, request):

        request.organization = request.headers.get(self.HEADER)

        return request
