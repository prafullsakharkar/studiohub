from apps.identity.constants.permissions import (
    UserPreferencePermissions,
)

from apps.identity.api.filtersets.user_preference import (
    UserPreferenceFilterSet,
)
from apps.identity.api.serializers.user_preference import (
    UserPreferenceCreateSerializer,
    UserPreferenceDetailSerializer,
    UserPreferenceListSerializer,
    UserPreferenceUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.models import UserPreference
from apps.identity.selectors.user_preference import (
    UserPreferenceSelector,
)
from apps.identity.services.user_preference import (
    UserPreferenceService,
)


class UserPreferenceViewSet(
    IdentityViewSet,
):

    queryset = UserPreference.objects.all()

    selector_class = UserPreferenceSelector

    service_class = UserPreferenceService

    filterset_class = UserPreferenceFilterSet

    serializer_map = {
        "list": UserPreferenceListSerializer,
        "retrieve": UserPreferenceDetailSerializer,
        "create": UserPreferenceCreateSerializer,
        "update": UserPreferenceUpdateSerializer,
        "partial_update": UserPreferenceUpdateSerializer,
    }

    permission_map = {
        "list": (UserPreferencePermissions.VIEW,),
        "retrieve": (UserPreferencePermissions.VIEW,),
        "create": (UserPreferencePermissions.CREATE,),
        "update": (UserPreferencePermissions.UPDATE,),
        "partial_update": (UserPreferencePermissions.UPDATE,),
        "destroy": (UserPreferencePermissions.DELETE,),
    }
