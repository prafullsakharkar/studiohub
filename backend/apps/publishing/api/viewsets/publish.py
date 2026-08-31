"""
Publishing viewset for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.publish import (
    PublishListSerializer,
    PublishDetailSerializer,
    PublishCreateSerializer,
    PublishUpdateSerializer,
    PublishValidateSerializer,
    PublishRepublishSerializer,
    PublishUnpublishSerializer,
    PublishRetrySerializer,
)
from apps.publishing.models import PublishItem
from apps.publishing.selectors.publish import get_publish_queryset
from apps.publishing.services.publish import (
    create_publish_item,
    validate_publish,
    republish,
    unpublish,
    retry_publish,
)


class PublishingViewSet(ServiceModelViewSet):
    """ViewSet for PublishItem."""
    
    queryset = PublishItem.objects.all()
    selector_class = None  # Using custom get_queryset
    service_class = None  # Using direct service calls
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    lookup_field = "uuid"
    
    serializer_map = {
        "list": PublishListSerializer,
        "retrieve": PublishDetailSerializer,
        "create": PublishCreateSerializer,
        "update": PublishUpdateSerializer,
        "partial_update": PublishUpdateSerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
        "validate": (),
        "republish": (),
        "unpublish": (),
        "retry": (),
    }
    
    search_fields = ("name", "code", "entity_code", "entity_name")
    ordering_fields = ("name", "created_at", "status")
    
    def get_queryset(self):
        """Get filtered publish queryset."""
        return get_publish_queryset(request=self.request, view=self)
    
    def perform_create(self, serializer):
        """Create publish with organization from request."""
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        
        serializer.save(organization=org, created_by=self.request.user if self.request.user.is_authenticated else None)
    
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
