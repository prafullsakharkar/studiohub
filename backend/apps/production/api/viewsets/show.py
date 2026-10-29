from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.show import ShowFilterSet
from apps.production.api.serializers.show.create import ShowCreateSerializer
from apps.production.api.serializers.show.detail import ShowDetailSerializer
from apps.production.api.serializers.show.list import ShowListSerializer
from apps.production.api.serializers.show.update import ShowUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import ShowPermissions
from apps.production.selectors.show import ShowSelector
from apps.production.services.show import ShowService


class ShowViewSet(ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat CRUD for shows (frontend show switcher + show_id scoping)."""

    selector_class = ShowSelector
    service_class = ShowService
    pagination_class = StandardPagination
    filterset_class = ShowFilterSet

    serializer_map = {
        "list": ShowListSerializer,
        "retrieve": ShowDetailSerializer,
        "create": ShowCreateSerializer,
        "update": ShowUpdateSerializer,
        "partial_update": ShowUpdateSerializer,
    }

    permission_map = {
        "list": (ShowPermissions.VIEW,),
        "retrieve": (ShowPermissions.VIEW,),
        "create": (ShowPermissions.CREATE,),
        "update": (ShowPermissions.UPDATE,),
        "partial_update": (ShowPermissions.UPDATE,),
        "destroy": (ShowPermissions.DELETE,),
        "archived": (ShowPermissions.VIEW,),
        "restore": (ShowPermissions.UPDATE,),
    }

    search_fields = ("name", "code", "description")
    ordering_fields = ("code", "name", "created_at")

    def create(self, request, *args, **kwargs):
        # Respond with the full detail shape, not the write shape.
        from rest_framework.response import Response

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = ShowDetailSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=201, headers=headers)
