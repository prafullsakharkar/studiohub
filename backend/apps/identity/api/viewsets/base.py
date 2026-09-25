from apps.core.api.viewsets.service import (
    ServiceModelViewSet,
)
from apps.core.permissions.base import (
    IsAuthenticatedPermission,
)
from apps.identity.permissions import (
    HasPermission,
)


class IdentityViewSet(ServiceModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
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

    def perform_authentication(self, request):
        """
        Resolve the organization context after authentication.

        Middleware runs before DRF authentication, so org context must be
        re-resolved here (fail-closed) before selectors scope by it
        (ADR-0033 D6: the user directory is organization-scoped).
        """
        response = super().perform_authentication(request)
        from apps.organization.middleware.organization_context import (
            resolve_organization_context,
        )

        resolve_organization_context(request, force=True)
        return response

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
