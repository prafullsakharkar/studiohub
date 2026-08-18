from apps.identity.api.filtersets.user_preference import (
    SecurityEventFilterSet,
)
from apps.identity.api.serializers.user_preference import (
    SecurityEventCreateSerializer,
    SecurityEventDetailSerializer,
    SecurityEventListSerializer,
    SecurityEventUpdateSerializer,
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
    IdentityViewSet,
):
    """
    API endpoint for SecurityEvent.
    """

    queryset = SecurityEvent.objects.all()

    selector_class = SecurityEventSelector

    service_class = SecurityEventService

    filterset_class = SecurityEventFilterSet

    serializer_map = {
        "list": SecurityEventListSerializer,
        "retrieve": SecurityEventDetailSerializer,
        "create": SecurityEventCreateSerializer,
        "update": SecurityEventUpdateSerializer,
        "partial_update": SecurityEventUpdateSerializer,
    }

    permission_map = {
        "list": (SecurityEventPermissions.VIEW,),
        "retrieve": (SecurityEventPermissions.VIEW,),
        "create": (SecurityEventPermissions.CREATE,),
        "update": (SecurityEventPermissions.UPDATE,),
        "partial_update": (SecurityEventPermissions.UPDATE,),
        "destroy": (SecurityEventPermissions.DELETE,),
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
