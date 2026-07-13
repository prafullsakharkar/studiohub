from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets.role import (
    RoleFilterSet,
)
from apps.identity.api.serializers.role import (
    RoleCreateSerializer,
    RoleDetailSerializer,
    RoleListSerializer,
    RoleUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    RolePermissions,
)
from apps.identity.models import (
    Role,
)
from apps.identity.selectors.role import (
    RoleSelector,
)
from apps.identity.services.role import (
    RoleService,
)


class RoleViewSet(
    IdentityViewSet,
):

    queryset = Role.objects.all()

    selector_class = RoleSelector

    service_class = RoleService

    filterset_class = RoleFilterSet

    serializer_map = {
        "list": RoleListSerializer,
        "retrieve": RoleDetailSerializer,
        "create": RoleCreateSerializer,
        "update": RoleUpdateSerializer,
        "partial_update": RoleUpdateSerializer,
    }

    permission_map = {
        "list": (RolePermissions.VIEW,),
        "retrieve": (RolePermissions.VIEW,),
        "create": (RolePermissions.CREATE,),
        "update": (RolePermissions.UPDATE,),
        "partial_update": (RolePermissions.UPDATE,),
        "destroy": (RolePermissions.DELETE,),
        "activate": (RolePermissions.ACTIVATE,),
        "deactivate": (RolePermissions.DEACTIVATE,),
        "archive": (RolePermissions.ARCHIVE,),
        "restore": (RolePermissions.RESTORE,),
    }

    @action(
        detail=True,
        methods=["post"],
    )
    def activate(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.activate(
            instance,
        )

        return Response(
            {
                "detail": "Role activated successfully.",
            },
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def deactivate(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.deactivate(
            instance,
        )

        return Response(
            {
                "detail": "Role deactivated successfully.",
            },
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def archive(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.archive(
            instance,
        )

        return Response(
            {
                "detail": "Role archived successfully.",
            },
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def restore(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.restore(
            instance,
        )

        return Response(
            {
                "detail": "Role restored successfully.",
            },
        )
