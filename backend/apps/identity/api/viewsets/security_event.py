from apps.identity.api.filtersets.user_preference import (
    SecurityEventFilterSet,
)
from apps.identity.api.serializers.user_preference import (
    SecurityEventCreateSerializer,
    SecurityEventDetailSerializer,
    SecurityEventListSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    SecurityEventPermissions,
)
from apps.identity.models import (
    SecurityEvent,
)
from apps.identity.selectors.security_event import (
    SecurityEventSelector,
)
from apps.identity.services.security_event import (
    SecurityEventService,
)


class SecurityEventViewSet(
    IdentityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for SecurityEvent.
    """

    # Append-only ledger (SEC-AUD-01): read and create only. No update or
    # destroy route is allowed, so a recorded row can never be rewritten.
    http_method_names = ["get", "post", "head", "options"]

    queryset = SecurityEvent.objects.all()

    selector_class = SecurityEventSelector

    service_class = SecurityEventService

    filterset_class = SecurityEventFilterSet

    serializer_map = {
        "list": SecurityEventListSerializer,
        "retrieve": SecurityEventDetailSerializer,
        "create": SecurityEventCreateSerializer,
    }

    permission_map = {
        "list": (SecurityEventPermissions.VIEW,),
        "retrieve": (SecurityEventPermissions.VIEW,),
        "create": (SecurityEventPermissions.CREATE,),
    }

    def perform_create(
        self,
        serializer,
    ):
        data = dict(
            serializer.validated_data,
        )

        data.setdefault(
            "user",
            self.request.user,
        )

        serializer.instance = self.service_class.create(
            **data,
        )
