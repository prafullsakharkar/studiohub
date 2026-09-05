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
    Profile,
    User,
)
from apps.identity.selectors.user import (
    UserSelector,
)
from apps.identity.services.password import (
    PasswordService,
)
from apps.identity.services.profile import (
    ProfileService,
)
from apps.identity.services.user import (
    UserService,
)
from apps.identity.services.user_password import (
    UserPasswordService,
)
from apps.identity.services.user_session import (
    UserSessionService,
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
        # NOTE: list/retrieve/me stay open to any authenticated user
        # (member-directory / self-service contract asserted by tests).
        "create": (UserPermissions.CREATE,),
        "update": (UserPermissions.UPDATE,),
        "partial_update": (UserPermissions.UPDATE,),
        "destroy": (UserPermissions.DELETE,),
        "activate": (UserPermissions.ACTIVATE,),
        "deactivate": (UserPermissions.DEACTIVATE,),
        "archive": (UserPermissions.ARCHIVE,),
        "restore": (UserPermissions.RESTORE,),
        "change_password": (UserPermissions.CHANGE_PASSWORD,),
        "suspend": (UserPermissions.DEACTIVATE,),
        "unsuspend": (UserPermissions.ACTIVATE,),
        "reset_password": (UserPermissions.RESET_PASSWORD,),
        "force_password_change": (UserPermissions.UPDATE,),
        "revoke_sessions": (UserPermissions.UPDATE,),
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
        pk=None,
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
        pk=None,
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
        pk=None,
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
        pk=None,
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

        self.password_service_class.change_password(
            user=request.user,
            password=serializer.validated_data["new_password"],
        )

        return Response(
            {
                "detail": "Password changed successfully.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def suspend(
        self,
        request,
        pk=None,
    ):
        user = self.get_object()

        self.service_class.deactivate(
            user,
        )

        return Response(
            {
                "detail": "User suspended successfully.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def unsuspend(
        self,
        request,
        pk=None,
    ):
        user = self.get_object()

        self.service_class.activate(
            user,
        )

        return Response(
            {
                "detail": "User unsuspended successfully.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
        url_path="reset-password",
    )
    def reset_password(
        self,
        request,
        pk=None,
    ):
        user = self.get_object()

        PasswordService.request_password_reset(
            user.email,
        )

        return Response(
            {
                "detail": "If an account exists, a password reset email has been sent.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
        url_path="force-password-change",
    )
    def force_password_change(
        self,
        request,
        pk=None,
    ):
        user = self.get_object()

        profile = Profile.objects.filter(
            user=user,
        ).first()

        if profile is None:
            profile = ProfileService.create(
                user=user,
            )

        profile.must_change_password = True

        profile.save(
            update_fields=[
                "must_change_password",
                "updated_at",
            ],
        )

        return Response(
            {
                "detail": "User must change password at next login.",
            },
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
        url_path="revoke-sessions",
    )
    def revoke_sessions(
        self,
        request,
        pk=None,
    ):
        user = self.get_object()

        count = UserSessionService.logout_all(
            user=user,
        )

        return Response(
            {
                "sessions": count,
            },
        )
