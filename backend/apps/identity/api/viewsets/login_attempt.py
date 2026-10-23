from apps.identity.api.filtersets.login_attempt import (
    LoginAttemptFilterSet,
)
from apps.identity.api.serializers.login_attempt import (
    LoginAttemptCreateSerializer,
    LoginAttemptDetailSerializer,
    LoginAttemptListSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    LoginAttemptPermissions,
)
from apps.identity.models import (
    LoginAttempt,
)
from apps.identity.selectors.login_attempt import (
    LoginAttemptSelector,
)
from apps.identity.services.login_attempt import (
    LoginAttemptService,
)


class LoginAttemptViewSet(
    IdentityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for LoginAttempt.
    """

    # Append-only ledger (SEC-AUD-01): read and create only. No update or
    # destroy route is allowed, so a recorded row can never be rewritten.
    http_method_names = ["get", "post", "head", "options"]

    queryset = LoginAttempt.objects.all()

    selector_class = LoginAttemptSelector

    service_class = LoginAttemptService

    filterset_class = LoginAttemptFilterSet

    serializer_map = {
        "list": LoginAttemptListSerializer,
        "retrieve": LoginAttemptDetailSerializer,
        "create": LoginAttemptCreateSerializer,
    }

    permission_map = {
        "list": (LoginAttemptPermissions.VIEW,),
        "retrieve": (LoginAttemptPermissions.VIEW,),
        "create": (LoginAttemptPermissions.CREATE,),
    }
