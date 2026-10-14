"""
Base ViewSet for Audit entities.
"""

from apps.core.api.viewsets.base import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.middleware.organization_context import (
    resolve_organization_context as _resolve_organization_context,
)


class AuditEntityViewSet(ServiceModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Base ViewSet for all Audit entities.

    Shared by:

        • AuditLog
        • AuditTrail

    Reads are open to authenticated users (org-scoped selectors); mutations
    require explicit codes in each viewset's ``permission_map``.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    lookup_field = "uuid"

    # No global ordering/search defaults: audit models do not share a
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
