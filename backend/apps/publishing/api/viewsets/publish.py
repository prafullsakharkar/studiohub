"""
Publishing viewset for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services.background_job import BackgroundJobService
from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.viewsets.scoped import OrganizationScopedViewSet
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


class PublishingViewSet(OrganizationScopedViewSet):  # pyright: ignore[reportMissingTypeArgument]
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

    def get_perform_create_kwargs(self):
        user = self.request.user
        return {
            "created_by": user if user.is_authenticated else None,
        }

    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Validate publish pre-flight rules."""
        publish = self.get_object()
        serializer = PublishValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = validate_publish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            organization_id=str(request.organization.id),
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
            organization_id=str(request.organization.id),
            description=f"Republish {getattr(publish, 'code', '') or publish.entity_name}",
            executor=republish,
            executor_kwargs={
                "publish_id": str(publish.id),
                "user_id": str(request.user.id) if request.user.is_authenticated else None,
                "organization_id": str(request.organization.id),
            },
        )

        result_id = (job.result_data or {}).get("result_id")
        new_publish = (
            PublishSelector.model.objects.filter(
                pk=result_id,
                organization_id=request.organization.id,
            ).first()
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
            organization_id=str(request.organization.id),
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
            organization_id=str(request.organization.id),
        )

        return Response(PublishDetailSerializer(publish).data)
