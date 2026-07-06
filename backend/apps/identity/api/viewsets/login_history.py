from apps.identity.constants.permissions import (
    LoginHistoryPermissions,
)

from apps.identity.api.filtersets.login_history import (
    LoginHistoryFilterSet,
)
from apps.identity.api.serializers.login_history import (
    LoginHistoryCreateSerializer,
    LoginHistoryDetailSerializer,
    LoginHistoryListSerializer,
    LoginHistoryUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.models import (
    LoginHistory,
)
from apps.identity.selectors.login_history import (
    LoginHistorySelector,
)
from apps.identity.services.login_history import (
    LoginHistoryService,
)


class LoginHistoryViewSet(
    IdentityViewSet,
):
    """
    API endpoint for LoginHistory.
    """

    queryset = LoginHistory.objects.all()

    selector_class = LoginHistorySelector

    service_class = LoginHistoryService

    filterset_class = LoginHistoryFilterSet

    serializer_map = {
        "list": LoginHistoryListSerializer,
        "retrieve": LoginHistoryDetailSerializer,
        "create": LoginHistoryCreateSerializer,
        "update": LoginHistoryUpdateSerializer,
        "partial_update": LoginHistoryUpdateSerializer,
    }

    permission_map = {
        "list": (LoginHistoryPermissions.VIEW,),
        "retrieve": (LoginHistoryPermissions.VIEW,),
        "create": (LoginHistoryPermissions.VIEW,),
        "update": (LoginHistoryPermissions.VIEW,),
        "partial_update": (LoginHistoryPermissions.VIEW,),
        "destroy": (LoginHistoryPermissions.DELETE,),
    }
