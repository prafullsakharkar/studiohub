from apps.identity.api.filtersets.login_attempt import (
    LoginAttemptFilterSet,
)
from apps.identity.api.serializers.login_attempt import (
    LoginAttemptCreateSerializer,
    LoginAttemptDetailSerializer,
    LoginAttemptListSerializer,
    LoginAttemptUpdateSerializer,
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
    IdentityViewSet,
):
    """
    API endpoint for LoginAttempt.
    """

    queryset = LoginAttempt.objects.all()

    selector_class = LoginAttemptSelector

    service_class = LoginAttemptService

    filterset_class = LoginAttemptFilterSet

    serializer_map = {
        "list": LoginAttemptListSerializer,
        "retrieve": LoginAttemptDetailSerializer,
        "create": LoginAttemptCreateSerializer,
        "update": LoginAttemptUpdateSerializer,
        "partial_update": LoginAttemptUpdateSerializer,
    }

    permission_map = {
        "list": (LoginAttemptPermissions.VIEW,),
        "retrieve": (LoginAttemptPermissions.VIEW,),
        "create": (LoginAttemptPermissions.CREATE,),
        "update": (LoginAttemptPermissions.UPDATE,),
        "partial_update": (LoginAttemptPermissions.UPDATE,),
        "destroy": (LoginAttemptPermissions.DELETE,),
    }
