from apps.identity.api.filtersets.user_preference import (
    TrustedDeviceFilterSet,
)
from apps.identity.api.serializers.user_preference import (
    TrustedDeviceCreateSerializer,
    TrustedDeviceDetailSerializer,
    TrustedDeviceListSerializer,
    TrustedDeviceUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    TrustedDevicePermissions,
)
from apps.identity.models import (
    TrustedDevice,
)
from apps.identity.selectors.trusted_device import (
    TrustedDeviceSelector,
)
from apps.identity.services.trusted_device import (
    TrustedDeviceService,
)


class TrustedDeviceViewSet(
    IdentityViewSet,
):

    queryset = TrustedDevice.objects.all()

    selector_class = TrustedDeviceSelector

    service_class = TrustedDeviceService

    filterset_class = TrustedDeviceFilterSet

    serializer_map = {
        "list": TrustedDeviceListSerializer,
        "retrieve": TrustedDeviceDetailSerializer,
        "create": TrustedDeviceCreateSerializer,
        "update": TrustedDeviceUpdateSerializer,
        "partial_update": TrustedDeviceUpdateSerializer,
    }

    # NOTE: reads/writes stay open to any authenticated user, but the
    # selector scopes them to the request user's own devices (staff see
    # all). Object-level scoping — not permission codes — is the control.
    permission_map = {
        "destroy": (TrustedDevicePermissions.DELETE,),
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
