"""Public version/environment info endpoint for the frontend header.

Serves exactly what the shell renders as its version//environment label. No
authentication — the payload must be a build metadata source of truth, never
a secret-bearing config dump.
"""

from __future__ import annotations

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.api.views.base import BaseAPIView


class VersionInfoView(BaseAPIView):
    """GET /api/v1/info/version/ — live application version + environment."""

    permission_classes = (AllowAny,)

    def get(self, request, *args, **kwargs):
        version = getattr(settings, "APP_VERSION", None) or getattr(
            settings, "VERSION", "1.0.0"
        )
        environment = getattr(settings, "APP_ENVIRONMENT", None) or getattr(
            settings, "ENVIRONMENT", "development"
        )
        payload = {
            "version": str(version),
            "environment": str(environment),
        }
        commit = getattr(settings, "APP_COMMIT", None)
        if commit:
            payload["commit"] = str(commit)
        return Response(payload, status=200)
