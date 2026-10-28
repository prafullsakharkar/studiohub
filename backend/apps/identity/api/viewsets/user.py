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
from apps.identity.services.password import (
    PasswordService,
)
from apps.identity.services.user import (
    UserService,
)
from apps.identity.services.user_admin_guard import UserAdministrationGuard
from apps.identity.services.user_session import (
    UserSessionService,
)


class UserViewSet(
    IdentityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    queryset = User.objects.all()

    selector_class = UserSelector

    service_class = UserService

    filterset_class = UserFilterSet
    password_service_class = PasswordService

    serializer_map = {
        "list": UserListSerializer,
        "retrieve": UserDetailSerializer,
        "create": UserCreateSerializer,
        "update": UserUpdateSerializer,
        "partial_update": UserUpdateSerializer,
        "me": UserMeSerializer,
        "change_password": UserChangePasswordSerializer,
    }

    # A scoped API key / PAT may still ask who it is; it reaches nothing else without a code.
    credential_open_actions = ("me",)

    permission_map = {
        # ADR-0033 D6: the user directory is organization-scoped.
        # list/retrieve require the identity.user.view grant and are
        # narrowed to users sharing an active membership in the request
        # organization (superusers see all). ``me`` stays open for
        # self-service.
        "list": (UserPermissions.VIEW,),
        "retrieve": (UserPermissions.VIEW,),
        "me": (),
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

    #: detail actions that change another user's account; each is checked against the target
    ADMINISTRATIVE_ACTIONS = frozenset(
        {
            "update",
            "partial_update",
            "destroy",
            "activate",
            "deactivate",
            "archive",
            "restore",
            "change_password",
            "suspend",
            "unsuspend",
            "reset_password",
            "force_password_change",
            "revoke_sessions",
        }
    )

    def get_object(self):
        user = super().get_object()

        if self.action in self.ADMINISTRATIVE_ACTIONS:
            UserAdministrationGuard.require_may_administer(self.request.user, user)

        return user

    def perform_create(self, serializer):
        self._guard_privileged_fields(serializer.validated_data, None)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._guard_privileged_fields(serializer.validated_data, serializer.instance)
        super().perform_update(serializer)

    def _holds(self, code):
        """Whether the caller holds ``code``: superuser, or a role grant within any credential scope."""
        from apps.identity.permissions.scopes import credential_scopes
        from apps.identity.services.permission_cache import PermissionCacheService

        actor = self.request.user

        scopes = credential_scopes(self.request)

        if scopes is not None and code not in scopes:
            return False

        return bool(
            getattr(actor, "is_superuser", False)
            or PermissionCacheService.has_permission(user=actor, permission=code)
        )

    def _guard_privileged_fields(self, data, instance):
        """
        Fields that need more than the update permission.

        ``is_staff`` widens what a user can see (the whole directory, the admin site), so only a
        superuser grants or removes it. ``is_active`` has its own permissions: flipping it through a
        plain update must not be a way around them.
        """
        from rest_framework.exceptions import PermissionDenied

        actor = self.request.user

        if "is_staff" in data:
            current = bool(instance.is_staff) if instance is not None else False

            if bool(data["is_staff"]) != current and not getattr(actor, "is_superuser", False):
                raise PermissionDenied("Only a superuser can grant or remove staff status.")

        if (
            instance is not None
            and "is_active" in data
            and bool(data["is_active"]) != instance.is_active
        ):
            needed = UserPermissions.ACTIVATE if data["is_active"] else UserPermissions.DEACTIVATE

            if not self._holds(needed):
                raise PermissionDenied(f"Changing is_active needs the '{needed}' permission.")

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
            old_password=serializer.validated_data["old_password"],
            new_password=serializer.validated_data["new_password"],
            request=request,
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

        UserService.reset_password(
            instance=user,
            user=request.user,
        )

        return Response(
            {
                "detail": "Password reset. The user must change their password on next sign-in.",
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

        UserService.reset_password(
            instance=user,
            user=request.user,
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
