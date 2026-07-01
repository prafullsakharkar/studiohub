"""
Audit middleware.
"""

from .base import BaseMiddleware


class AuditMiddleware(BaseMiddleware):

    def process_request(self, request):

        request.audit_user = request.user if request.user.is_authenticated else None

        return request
