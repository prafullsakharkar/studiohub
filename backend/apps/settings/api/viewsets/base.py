"""
Base ViewSet for Settings entities.
"""

from __future__ import annotations

from apps.core.api.viewsets.base import ServiceModelViewSet


class SettingsBaseViewSet(ServiceModelViewSet):
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

    def get_queryset(self):
        return self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
