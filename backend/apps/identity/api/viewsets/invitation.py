from apps.identity.api.filtersets import InvitationFilterSet
from apps.identity.api.serializers.invitation import (
    InvitationCreateSerializer,
    InvitationDetailSerializer,
    InvitationListSerializer,
    InvitationUpdateSerializer,
)
from apps.identity.models import Invitation
from apps.identity.permissions.invitation import (
    InvitationPermissions,
)
from apps.identity.selectors import InvitationSelector
from apps.identity.services import InvitationService

from .base import IdentityViewSet


class InvitationViewSet(
    IdentityViewSet,
):

    queryset = Invitation.objects.none()

    selector_class = InvitationSelector

    service_class = InvitationService

    filterset_class = InvitationFilterSet

    serializer_map = {
        "list": InvitationListSerializer,
        "retrieve": InvitationDetailSerializer,
        "create": InvitationCreateSerializer,
        "update": InvitationUpdateSerializer,
        "partial_update": InvitationUpdateSerializer,
    }

    permission_map = {
        "list": (InvitationPermissions.VIEW,),
        "retrieve": (InvitationPermissions.VIEW,),
        "create": (InvitationPermissions.CREATE,),
        "update": (InvitationPermissions.UPDATE,),
        "partial_update": (InvitationPermissions.UPDATE,),
        "destroy": (InvitationPermissions.DELETE,),
    }
