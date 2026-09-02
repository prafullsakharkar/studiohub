from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.shot import ShotFilterSet
from apps.production.api.serializers.shot.create import ShotCreateSerializer
from apps.production.api.serializers.shot.detail import ShotDetailSerializer
from apps.production.api.serializers.shot.list import ShotListSerializer
from apps.production.api.serializers.shot.update import ShotUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import ShotPermissions
from apps.production.selectors.shot import ShotSelector
from apps.production.services.shot import ShotService


class ShotViewSet(ProductionEntityViewSet):
    selector_class = ShotSelector
    service_class = ShotService
    pagination_class = StandardPagination
    filterset_class = ShotFilterSet

    serializer_map = {
        "list": ShotListSerializer,
        "retrieve": ShotDetailSerializer,
        "create": ShotCreateSerializer,
        "update": ShotUpdateSerializer,
        "partial_update": ShotUpdateSerializer,
    }

    permission_map = {
        "list": (ShotPermissions.VIEW,),
        "retrieve": (ShotPermissions.VIEW,),
        "create": (ShotPermissions.CREATE,),
        "update": (ShotPermissions.UPDATE,),
        "partial_update": (ShotPermissions.UPDATE,),
        "destroy": (ShotPermissions.DELETE,),
        "approve": (ShotPermissions.APPROVE,),
    }

    search_fields = ("code", "name", "description", "sequence_code")
    ordering_fields = ("code", "name", "created_at", "status")

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "Approved"
        instance.supervisor_approved = True
        if instance.pipeline:
            for k in instance.pipeline:
                instance.pipeline[k] = "Approved"
        instance.save(update_fields=["status", "supervisor_approved", "pipeline"])
        serializer = ShotDetailSerializer(instance)
        return Response(serializer.data)
