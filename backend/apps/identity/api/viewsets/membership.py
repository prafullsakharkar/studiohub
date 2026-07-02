from apps.identity.permissions.membership import (
    MembershipPermissions,
)

from apps.identity.api.filtersets import MembershipFilterSet
from apps.identity.api.serializers.membership import (
    MembershipCreateSerializer,
    MembershipDetailSerializer,
    MembershipListSerializer,
    MembershipUpdateSerializer,
)
from apps.identity.models import OrganizationMembership
from apps.identity.selectors import MembershipSelector
from apps.identity.services import MembershipService

from .base import IdentityViewSet


class MembershipViewSet(IdentityViewSet):
    """
    CRUD API for Organization Membership.
    """

    queryset = OrganizationMembership.objects.none()

    selector_class = MembershipSelector

    service_class = MembershipService

    filterset_class = MembershipFilterSet

    serializer_map = {
        "list": MembershipListSerializer,
        "retrieve": MembershipDetailSerializer,
        "create": MembershipCreateSerializer,
        "update": MembershipUpdateSerializer,
        "partial_update": MembershipUpdateSerializer,
    }

    permission_map = {
        "list": (MembershipPermissions.VIEW,),
        "retrieve": (MembershipPermissions.VIEW,),
        "create": (MembershipPermissions.CREATE,),
        "update": (MembershipPermissions.UPDATE,),
        "partial_update": (MembershipPermissions.UPDATE,),
        "destroy": (MembershipPermissions.DELETE,),
    }
