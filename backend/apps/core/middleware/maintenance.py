"""
Maintenance middleware.
"""

from django.conf import settings
from django.http import JsonResponse

from .base import BaseMiddleware


class MaintenanceMiddleware(BaseMiddleware):

    def process_request(self, request):

        if getattr(
            settings,
            "MAINTENANCE_MODE",
            False,
        ):
            return JsonResponse(
                {"detail": "System under maintenance."},
                status=503,
            )

        return request
