from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets.membership import (
    MembershipFilterSet,
)
from apps.identity.api.serializers.membership import (
    MembershipCreateSerializer,
    MembershipDetailSerializer,
    MembershipListSerializer,
    MembershipUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    MembershipPermissions,
)
from apps.identity.models import (
    OrganizationMembership,
)
from apps.identity.selectors.membership import (
    MembershipSelector,
)
from apps.identity.services.membership import (
    MembershipService,
)


class MembershipViewSet(
    IdentityViewSet,
):

    queryset = OrganizationMembership.objects.all()

    selector_class = MembershipSelector

    service_class = MembershipService

    filterset_class = MembershipFilterSet

    serializer_map = {
        "list": MembershipListSerializer,
        "retrieve": MembershipDetailSerializer,
        "create": MembershipCreateSerializer,
        "update": MembershipUpdateSerializer,
        "partial_update": MembershipUpdateSerializer,
    }

    permission_map = {
        "list": (MembershipPermissions.VIEW,),
        "retrieve": (MembershipPermissions.VIEW,),
        "create": (MembershipPermissions.CREATE,),
        "update": (MembershipPermissions.UPDATE,),
        "partial_update": (MembershipPermissions.UPDATE,),
        "destroy": (MembershipPermissions.DELETE,),
        "activate": (MembershipPermissions.ACTIVATE,),
        "deactivate": (MembershipPermissions.DEACTIVATE,),
        "archive": (MembershipPermissions.ARCHIVE,),
        "restore": (MembershipPermissions.RESTORE,),
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
        membership = self.get_object()

        self.service_class.activate(
            membership,
        )

        return Response(
            {
                "detail": "Membership activated successfully.",
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
        membership = self.get_object()

        self.service_class.deactivate(
            membership,
        )

        return Response(
            {
                "detail": "Membership deactivated successfully.",
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
        membership = self.get_object()

        self.service_class.archive(
            membership,
        )

        return Response(
            {
                "detail": "Membership archived successfully.",
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
        membership = self.get_object()

        self.service_class.restore(
            membership,
        )

        return Response(
            {
                "detail": "Membership restored successfully.",
            },
        )
