from apps.identity.constants.permissions import (
    UserSessionPermissions,
)

from apps.identity.api.filtersets.user_session import (
    UserSessionFilterSet,
)
from apps.identity.api.serializers.user_session import (
    UserSessionCreateSerializer,
    UserSessionDetailSerializer,
    UserSessionListSerializer,
    UserSessionUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.models import (
    UserSession,
)
from apps.identity.selectors.user_session import (
    UserSessionSelector,
)
from apps.identity.services.user_session import (
    UserSessionService,
)


class UserSessionViewSet(
    IdentityViewSet,
):
    """
    API endpoint for UserSession.
    """

    queryset = UserSession.objects.all()

    selector_class = UserSessionSelector

    service_class = UserSessionService

    filterset_class = UserSessionFilterSet

    serializer_map = {
        "list": UserSessionListSerializer,
        "retrieve": UserSessionDetailSerializer,
        "create": UserSessionCreateSerializer,
        "update": UserSessionUpdateSerializer,
        "partial_update": UserSessionUpdateSerializer,
    }

    permission_map = {
        "list": (UserSessionPermissions.VIEW,),
        "retrieve": (UserSessionPermissions.VIEW,),
        "create": (UserSessionPermissions.CREATE,),
        "update": (UserSessionPermissions.UPDATE,),
        "partial_update": (UserSessionPermissions.UPDATE,),
        "destroy": (UserSessionPermissions.DELETE,),
    }
