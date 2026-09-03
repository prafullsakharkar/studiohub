"""
Publishing viewset for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

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
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.publish import PublishSelector
from apps.publishing.services.publish import (
    republish,
    retry_publish,
    unpublish,
    validate_publish,
)


class PublishingViewSet(OrganizationScopedViewSet):
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

        return Response(result)

    @action(detail=True, methods=["post"], url_path="republish")
    def republish(self, request, *args, **kwargs):
        """Create new iteration of a publish."""
        publish = self.get_object()
        serializer = PublishRepublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_publish = republish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            organization_id=str(request.organization.id),
        )

        return Response(PublishDetailSerializer(new_publish).data, status=status.HTTP_201_CREATED)

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
