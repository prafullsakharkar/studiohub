from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets.user import (
    UserFilterSet,
)
from apps.identity.api.serializers.user import (
    UserChangePasswordSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserMeSerializer,
    UserUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    UserPermissions,
)
from apps.identity.models import (
    User,
)
from apps.identity.selectors.user import (
    UserSelector,
)
from apps.identity.services.user import (
    UserService,
)
from apps.identity.services.user_password import (
    UserPasswordService,
)


class UserViewSet(
    IdentityViewSet,
):

    queryset = User.objects.all()

    selector_class = UserSelector

    service_class = UserService

    filterset_class = UserFilterSet
    password_service_class = UserPasswordService

    serializer_map = {
        "list": UserListSerializer,
        "retrieve": UserDetailSerializer,
        "create": UserCreateSerializer,
        "update": UserUpdateSerializer,
        "partial_update": UserUpdateSerializer,
        "me": UserMeSerializer,
        "change_password": UserChangePasswordSerializer,
    }

    permission_map = {
        "list": (UserPermissions.VIEW,),
        "retrieve": (UserPermissions.VIEW,),
        "create": (UserPermissions.CREATE,),
        "update": (UserPermissions.UPDATE,),
        "partial_update": (UserPermissions.UPDATE,),
        "destroy": (UserPermissions.DELETE,),
        "me": (UserPermissions.VIEW,),
        "change_password": (UserPermissions.CHANGE_PASSWORD,),
    }

    @action(
        detail=False,
        methods=[
            "get",
        ],
    )
    def me(
        self,
        request,
    ):
        serializer = self.get_serializer(
            request.user,
        )

        return Response(
            serializer.data,
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def activate(
        self,
        request,
        uuid=None,
    ):
        user = self.get_object()

        self.service_class.activate(
            user,
        )

        return Response(
            {
                "detail": "User activated successfully.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def deactivate(
        self,
        request,
        uuid=None,
    ):
        user = self.get_object()

        self.service_class.deactivate(
            user,
        )

        return Response(
            {
                "detail": "User deactivated successfully.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def archive(
        self,
        request,
        uuid=None,
    ):
        user = self.get_object()

        self.service_class.archive(
            user,
        )

        return Response(
            {
                "detail": "User archived successfully.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def restore(
        self,
        request,
        uuid=None,
    ):
        user = self.get_object()

        self.service_class.restore(
            user,
        )

        return Response(
            {
                "detail": "User restored successfully.",
            },
        )

    @action(
        detail=False,
        methods=[
            "post",
        ],
    )
    def change_password(
        self,
        request,
    ):
        serializer = self.get_serializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        user = self.password_service_class.change_password(
            user=request.user,
            password=serializer.validated_data["new_password"],
        )

        return Response(
            {
                "detail": "Password changed successfully.",
            },
        )
