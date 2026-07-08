from apps.identity.permissions.personal_access_token import (
    PersonalAccessTokenPermissions,
)

from apps.identity.api.filtersets import (
    PersonalAccessTokenFilterSet,
)
from apps.identity.api.serializers.personal_access_token import (
    PersonalAccessTokenCreateSerializer,
    PersonalAccessTokenDetailSerializer,
    PersonalAccessTokenListSerializer,
    PersonalAccessTokenUpdateSerializer,
)
from apps.identity.models import (
    PersonalAccessToken,
)
from apps.identity.selectors import (
    PersonalAccessTokenSelector,
)
from apps.identity.services import (
    PersonalAccessTokenService,
)

from .base import IdentityViewSet


class PersonalAccessTokenViewSet(
    IdentityViewSet,
):

    queryset = PersonalAccessToken.objects.none()

    selector_class = PersonalAccessTokenSelector

    service_class = PersonalAccessTokenService

    filterset_class = PersonalAccessTokenFilterSet

    serializer_map = {
        "list": PersonalAccessTokenListSerializer,
        "retrieve": PersonalAccessTokenDetailSerializer,
        "create": PersonalAccessTokenCreateSerializer,
        "update": PersonalAccessTokenUpdateSerializer,
        "partial_update": PersonalAccessTokenUpdateSerializer,
    }

    permission_map = {
        "list": (PersonalAccessTokenPermissions.VIEW,),
        "retrieve": (PersonalAccessTokenPermissions.VIEW,),
        "create": (PersonalAccessTokenPermissions.CREATE,),
        "update": (PersonalAccessTokenPermissions.UPDATE,),
        "partial_update": (PersonalAccessTokenPermissions.UPDATE,),
        "destroy": (PersonalAccessTokenPermissions.DELETE,),
    }
