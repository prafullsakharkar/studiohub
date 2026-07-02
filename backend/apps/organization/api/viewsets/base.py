"""
Base ViewSet for Organization entities.
"""

from apps.core.api.viewsets.base import ServiceModelViewSet


class OrganizationEntityViewSet(ServiceModelViewSet):
    """
    Base ViewSet for all Organization entities.

    Shared by:

        • Department
        • Team
        • Office
    """

    lookup_field = "uuid"
    ordering = ("name",)

    search_fields = (
        "code",
        "name",
    )

    ordering_fields = (
        "code",
        "name",
        "created_at",
        "updated_at",
    )

    def get_queryset(self):
        return self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
