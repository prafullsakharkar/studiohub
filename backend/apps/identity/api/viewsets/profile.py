from apps.identity.api.filtersets.user_preference import (
    ProfileFilterSet,
)
from apps.identity.api.serializers.user_preference import (
    ProfileCreateSerializer,
    ProfileDetailSerializer,
    ProfileListSerializer,
    ProfileUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    ProfilePermissions,
)
from apps.identity.models import (
    Profile,
)
from apps.identity.selectors.profile import (
    ProfileSelector,
)
from apps.identity.services.profile import (
    ProfileService,
)


class ProfileViewSet(
    IdentityViewSet,
):

    queryset = Profile.objects.all()

    selector_class = ProfileSelector

    service_class = ProfileService

    filterset_class = ProfileFilterSet

    serializer_map = {
        "list": ProfileListSerializer,
        "retrieve": ProfileDetailSerializer,
        "create": ProfileCreateSerializer,
        "update": ProfileUpdateSerializer,
        "partial_update": ProfileUpdateSerializer,
    }

    permission_map = {
        "destroy": (ProfilePermissions.DELETE,),
    }

    def perform_create(
        self,
        serializer,
    ):
        data = dict(
            serializer.validated_data,
        )

        data.setdefault(
            "user",
            self.request.user,
        )

        serializer.instance = self.service_class.create(
            **data,
        )
