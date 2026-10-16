"""
Base ViewSet for Settings entities.
"""

from __future__ import annotations

from apps.core.api.viewsets.platform import PlatformScopedViewSet


class SettingsBaseViewSet(PlatformScopedViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Base ViewSet for all Settings entities.

    Platform-global (org-free): querysets come from the selector's
    org-free reads; writes require platform ``settings.*`` codes in
    each viewset's ``permission_map``.

    Shared by:

        • SystemSettings
        • EmailSettings
        • NotificationSettings
    """

    lookup_field = "id"
    lookup_url_kwarg = "pk"

    # No global ordering/search defaults: settings models do not share a
    # ``name``/``code`` field. Each viewset configures its own fields.
