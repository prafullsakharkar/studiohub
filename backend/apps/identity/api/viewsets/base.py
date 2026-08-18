from apps.core.api.viewsets.service import (
    ServiceModelViewSet,
)
from apps.core.permissions.base import (
    IsAuthenticatedPermission,
)

from apps.identity.permissions import (
    HasPermission,
)


class IdentityViewSet(ServiceModelViewSet):
    """
    Base ViewSet for Identity entities.

    Uses the declarative ``serializer_map`` / ``permission_map`` contract and
    resolves detail routes by primary key (``pk`` URL kwarg), matching the
    public API surface.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    lookup_field = "id"

    lookup_url_kwarg = "pk"

    ordering = ("created_at",)

    def get_queryset(self):
        if hasattr(
            self,
            "selector_class",
        ) and self.selector_class:
            return self.selector_class.get_queryset(
                request=self.request,
                view=self,
            )

        return super().get_queryset()
