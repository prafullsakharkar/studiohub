"""
Base ViewSet for Audit entities.
"""

from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission


class AuditEntityViewSet(PlatformScopedViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Base ViewSet for all Audit entities.

    Platform-global (org-free): querysets come from the selector's
    org-free reads. Shared by:

        • AuditLog
        • AuditTrail

    Reads are gated by the ``audit.view`` permission code in each
    viewset's ``permission_map`` (platform-global rows, seeded to
    production-tier roles); mutations require explicit codes.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    lookup_field = "uuid"

    # No global ordering/search defaults: audit models do not share a
    # ``name``/``code`` field. Each viewset configures its own fields.
