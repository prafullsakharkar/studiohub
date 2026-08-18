"""
Base ViewSet for Audit entities.
"""

from apps.core.api.viewsets.base import ServiceModelViewSet


class AuditEntityViewSet(ServiceModelViewSet):
    """
    Base ViewSet for all Audit entities.

    Shared by:

        • AuditLog
        • AuditTrail
    """

    lookup_field = "uuid"

    # No global ordering/search defaults: audit models do not share a
    # ``name``/``code`` field. Each viewset configures its own fields.

    def get_queryset(self):
        return self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
