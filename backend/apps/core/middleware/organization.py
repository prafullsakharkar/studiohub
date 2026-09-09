"""
Organization middleware.
"""

from .base import BaseMiddleware


class OrganizationMiddleware(BaseMiddleware):

    HEADER = "X-Organization"
    HEADER_COMPAT = "X-Organization-Id"

    def process_request(self, request):

        request.organization = request.headers.get(self.HEADER) or request.headers.get(self.HEADER_COMPAT)

        return request
