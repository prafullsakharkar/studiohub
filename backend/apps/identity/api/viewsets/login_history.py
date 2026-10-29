from apps.identity.api.filtersets.login_history import (
    LoginHistoryFilterSet,
)
from apps.identity.api.serializers.login_history import (
    LoginHistoryDetailSerializer,
    LoginHistoryListSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    LoginHistoryPermissions,
)
from apps.identity.models import (
    LoginHistory,
)
from apps.identity.selectors.login_history import (
    LoginHistorySelector,
)


class LoginHistoryViewSet(
    IdentityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    Read-only API endpoint for LoginHistory.

    The history is append-only and written by the authentication flows
    (ADR-0035), so there is no create, update or delete route.
    """

    http_method_names = ["get", "head", "options"]

    queryset = LoginHistory.objects.all()

    selector_class = LoginHistorySelector

    filterset_class = LoginHistoryFilterSet

    serializer_map = {
        "list": LoginHistoryListSerializer,
        "retrieve": LoginHistoryDetailSerializer,
    }

    permission_map = {
        "list": (LoginHistoryPermissions.VIEW,),
        "retrieve": (LoginHistoryPermissions.VIEW,),
    }
