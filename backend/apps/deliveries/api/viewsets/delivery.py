"""
Delivery viewset for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.deliveries.api.serializers.delivery import (
    DeliveryListSerializer,
    DeliveryDetailSerializer,
    DeliveryCreateSerializer,
    DeliveryUpdateSerializer,
    DeliveryAddVersionSerializer,
    DeliveryValidateSerializer,
    DeliveryPrepareSerializer,
    DeliverySubmitSerializer,
    DeliveryApproveSerializer,
    DeliveryRejectSerializer,
)
from apps.deliveries.models import DeliveryPackage
from apps.deliveries.selectors.delivery import get_delivery_queryset
from apps.deliveries.services.delivery import (
    create_delivery,
    add_version_to_delivery,
    validate_delivery,
    prepare_delivery,
    submit_delivery,
    approve_delivery,
    reject_delivery,
    complete_delivery,
    cancel_delivery,
)


class DeliveryViewSet(ServiceModelViewSet):
    """ViewSet for DeliveryPackage."""
    
    queryset = DeliveryPackage.objects.all()
    selector_class = None  # Using custom get_queryset
    service_class = None  # Using direct service calls
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    lookup_field = "uuid"
    
    serializer_map = {
        "list": DeliveryListSerializer,
        "retrieve": DeliveryDetailSerializer,
        "create": DeliveryCreateSerializer,
        "update": DeliveryUpdateSerializer,
        "partial_update": DeliveryUpdateSerializer,
    }
    
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
        "update": (),
        "partial_update": (),
        "destroy": (),
        "add_version": (),
        "validate": (),
        "prepare": (),
        "submit": (),
        "approve": (),
        "reject": (),
        "complete": (),
        "cancel": (),
    }
    
    search_fields = ("name", "code", "client__name")
    ordering_fields = ("name", "created_at", "status")
    
    def get_queryset(self):
        """Get filtered delivery queryset."""
        return get_delivery_queryset(request=self.request, view=self)
    
    def perform_create(self, serializer):
        """Create delivery with organization from request."""
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
    
    @action(detail=True, methods=["post"], url_path="add-version")
    def add_version(self, request, *args, **kwargs):
        """Add a version to the delivery."""
        delivery = self.get_object()
        serializer = DeliveryAddVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ref = add_version_to_delivery(
            delivery_id=str(delivery.id),
            version_id=serializer.validated_data["version_id"],
            version_number=serializer.validated_data["version_number"],
            entity_type=serializer.validated_data["entity_type"],
            entity_code=serializer.validated_data["entity_code"],
            entity_name=serializer.validated_data["entity_name"],
            file_size_bytes=serializer.validated_data.get("file_size_bytes", 0),
            frame_count=serializer.validated_data.get("frame_count", 0),
            file_path=serializer.validated_data["file_path"],
            checksum_md5=serializer.validated_data.get("checksum_md5", ""),
            checksum_sha256=serializer.validated_data.get("checksum_sha256", ""),
        )
        
        return Response(DeliveryDetailSerializer(delivery).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Validate delivery package contents."""
        delivery = self.get_object()
        serializer = DeliveryValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        result = validate_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )
        
        return Response(result)
    
    @action(detail=True, methods=["post"], url_path="prepare")
    def prepare(self, request, *args, **kwargs):
        """Prepare delivery package for submission."""
        delivery = self.get_object()
        serializer = DeliveryPrepareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        result = prepare_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )
        
        return Response(result)
    
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, *args, **kwargs):
        """Submit delivery to destination."""
        delivery = self.get_object()
        serializer = DeliverySubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        result = submit_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )
        
        return Response(result)
    
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Approve delivery by client."""
        delivery = self.get_object()
        serializer = DeliveryApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        delivery = approve_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            client_notes=serializer.validated_data.get("client_notes", ""),
        )
        
        return Response(DeliveryDetailSerializer(delivery).data)
    
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        """Reject delivery with feedback."""
        delivery = self.get_object()
        serializer = DeliveryRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        delivery = reject_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            rejection_reason=serializer.validated_data["rejection_reason"],
        )
        
        return Response(DeliveryDetailSerializer(delivery).data)
    
    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, *args, **kwargs):
        """Mark delivery as complete."""
        delivery = self.get_object()
        
        delivery = complete_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )
        
        return Response(DeliveryDetailSerializer(delivery).data)
    
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, *args, **kwargs):
        """Cancel a delivery."""
        delivery = self.get_object()
        
        delivery = cancel_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            cancellation_reason=request.data.get("cancellation_reason", ""),
        )
        
        return Response(DeliveryDetailSerializer(delivery).data)
