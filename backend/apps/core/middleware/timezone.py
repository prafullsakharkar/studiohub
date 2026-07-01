"""
Timezone middleware.
"""

from django.utils import timezone

from .base import BaseMiddleware


class TimezoneMiddleware(BaseMiddleware):

    def process_request(self, request):

        if request.user.is_authenticated and hasattr(request.user, "timezone"):
            timezone.activate(request.user.timezone)

        return request

    def process_response(
        self,
        request,
        response,
    ):
        timezone.deactivate()

        return response
