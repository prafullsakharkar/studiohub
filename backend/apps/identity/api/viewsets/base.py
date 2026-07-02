from apps.core.api.viewsets.base import (
    ServiceModelViewSet,
)


class IdentityViewSet(ServiceModelViewSet):
    """
    Base ViewSet for Identity entities.
    """

    lookup_field = "uuid"

    ordering = ("created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
    )

    def get_queryset(self):
        if hasattr(
            self,
            "selector_class",
        ):
            return self.selector_class.get_queryset(
                request=self.request,
                view=self,
            )

        return super().get_queryset()
