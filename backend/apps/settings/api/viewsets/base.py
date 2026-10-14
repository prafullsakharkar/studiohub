"""
Base ViewSet for Settings entities.
"""

from __future__ import annotations

from apps.core.api.viewsets.base import ServiceModelViewSet
from apps.organization.middleware.organization_context import (
    resolve_organization_context as _resolve_organization_context,
)


class SettingsBaseViewSet(ServiceModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Base ViewSet for all Settings entities.

    Shared by:

        • SystemSettings
        • EmailSettings
        • NotificationSettings
    """

    lookup_field = "id"
    lookup_url_kwarg = "pk"

    # No global ordering/search defaults: settings models do not share a
    # ``name``/``code`` field. Each viewset configures its own fields.

    def perform_authentication(self, request):
        """Resolve org context post-auth so reads follow the active org."""
        response = super().perform_authentication(request)
        _resolve_organization_context(request, force=True)
        return response

    def get_queryset(self):
        return self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
