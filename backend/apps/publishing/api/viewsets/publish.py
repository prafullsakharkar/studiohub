"""
Publishing viewset for API endpoints.
"""
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services.background_job import BackgroundJobService
from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.publish import (
    PublishCreateSerializer,
    PublishDetailSerializer,
    PublishListSerializer,
    PublishRepublishSerializer,
    PublishRetrySerializer,
    PublishUnpublishSerializer,
    PublishUpdateSerializer,
    PublishValidateSerializer,
    frontend_result_status,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.publish import PublishSelector
from apps.publishing.services.publish import (
    republish,
    retry_publish,
    unpublish,
    validate_publish,
)


class PlatformCrudViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    """Platform-global CRUD (org-free).

    Querysets come from the selector's org-free reads. Destroy honors
    the Core soft-delete contract (same as the former org-scoped base).
    """

    # Same URL contract as the former org-scoped base: ``uuid`` kwarg
    # resolving against the ``id`` primary key.
    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    serializer_map = {}

    def get_serializer_class(self):
        action = getattr(self, "action", None)
        serializer = self.serializer_map.get(action)
        if serializer:
            return serializer
        if self.serializer_map and (action is None or action not in self.serializer_map):
            # Schema generation (drf-spectacular) introspects operations
            # before dispatch (no action set) and for unmapped actions;
            # fall back to the primary mapped serializer so OpenAPI can
            # resolve. Runtime behavior for mapped actions is unchanged.
            preferred = self.serializer_map.get("list")
            return preferred or next(iter(self.serializer_map.values()))
        return super().get_serializer_class()

    def perform_destroy(self, instance):
        from apps.core.services.soft_delete import SoftDeleteService

        if hasattr(instance, "is_deleted"):
            SoftDeleteService.delete(
                instance,
                user=getattr(self.request, "user", None),
            )
        else:
            instance.delete()


class PublishingViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for PublishItem."""

    selector_class = PublishSelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": PublishListSerializer,
        "retrieve": PublishDetailSerializer,
        "create": PublishCreateSerializer,
        "update": PublishUpdateSerializer,
        "partial_update": PublishUpdateSerializer,
    }

    permission_map = {
        "list": (PublishPermissions.VIEW,),
        "retrieve": (PublishPermissions.VIEW,),
        "create": (PublishPermissions.CREATE,),
        "update": (PublishPermissions.UPDATE,),
        "partial_update": (PublishPermissions.UPDATE,),
        "destroy": (PublishPermissions.DELETE,),
        "validate": (PublishPermissions.UPDATE,),
        "republish": (PublishPermissions.UPDATE,),
        "unpublish": (PublishPermissions.UPDATE,),
        "retry": (PublishPermissions.UPDATE,),
    }

    search_fields = ("name", "code", "entity_code", "entity_name")
    ordering_fields = ("name", "created_at", "status")

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user if user.is_authenticated else None)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Validate publish pre-flight rules."""
        publish = self.get_object()
        serializer = PublishValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = validate_publish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )

        return Response(frontend_result_status(result))

    @action(detail=True, methods=["post"], url_path="republish")
    def republish(self, request, *args, **kwargs):
        """Create new iteration of a publish."""
        publish = self.get_object()
        serializer = PublishRepublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job = BackgroundJobService.enqueue_and_run(
            job_type="export",
            description=f"Republish {getattr(publish, 'code', '') or publish.entity_name}",
            executor=republish,
            executor_kwargs={
                "publish_id": str(publish.id),
                "user_id": str(request.user.id) if request.user.is_authenticated else None,
            },
        )

        result_id = (job.result_data or {}).get("result_id")
        new_publish = (
            PublishSelector.model.objects.filter(pk=result_id).first()
            if result_id
            else None
        )

        return Response(
            PublishDetailSerializer(new_publish).data,
            status=status.HTTP_201_CREATED,
            headers={"X-Background-Job": job.job_id},
        )

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, *args, **kwargs):
        """Deprecate and unlink a publish."""
        publish = self.get_object()
        serializer = PublishUnpublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        publish = unpublish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )

        return Response(PublishDetailSerializer(publish).data)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        """Re-trigger a failed publish."""
        publish = self.get_object()
        serializer = PublishRetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        publish = retry_publish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )

        return Response(PublishDetailSerializer(publish).data)
