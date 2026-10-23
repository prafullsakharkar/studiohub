from apps.identity.api.filtersets.user_preference import (
    TrustedDeviceFilterSet,
)
from apps.identity.api.serializers.user_preference import (
    TrustedDeviceDetailSerializer,
    TrustedDeviceListSerializer,
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
    IdentityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):

    queryset = TrustedDevice.objects.all()

    selector_class = TrustedDeviceSelector

    service_class = TrustedDeviceService

    filterset_class = TrustedDeviceFilterSet

    serializer_map = {
        "list": TrustedDeviceListSerializer,
        "retrieve": TrustedDeviceDetailSerializer,
    }

    # API-ID-04: list, retrieve and revoke only, owner-scoped. Trust is minted
    # server-side after an MFA challenge and can never be created, edited or
    # un-revoked by a client (DOM-DEV-01/02).
    http_method_names = ["get", "delete", "head", "options"]

    # NOTE: reads stay open to any authenticated user, but the selector
    # scopes them to the request user's own devices (superusers see all).
    # Object-level scoping, not permission codes, is the control for reads.
    # Explicit empty tuples: HasPermission denies actions with no entry.
    permission_map = {
        "list": (),
        "retrieve": (),
        "destroy": (TrustedDevicePermissions.DELETE,),
    }

    def perform_destroy(
        self,
        instance,
    ):
        # Revoke, never hard-delete: the row is the audit trail of the grant.
        self.service_class.revoke(
            instance,
            actor=self.request.user,
        )
