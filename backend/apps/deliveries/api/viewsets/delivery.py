"""
Delivery viewset for API endpoints.
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services.background_job import BackgroundJobService
from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.deliveries.api.serializers.delivery import (
    STATUS_OUTPUT_MAP,
    DeliveryAddVersionSerializer,
    DeliveryApproveSerializer,
    DeliveryCreateSerializer,
    DeliveryDetailSerializer,
    DeliveryListSerializer,
    DeliveryPrepareSerializer,
    DeliveryRejectSerializer,
    DeliveryRemoveVersionSerializer,
    DeliverySubmitSerializer,
    DeliveryUpdateSerializer,
    DeliveryValidateSerializer,
)
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.selectors.delivery import DeliverySelector
from apps.deliveries.services.delivery import (
    add_version_to_delivery,
    approve_delivery,
    cancel_delivery,
    complete_delivery,
    prepare_delivery,
    reject_delivery,
    remove_version_from_delivery,
    retry_delivery,
    submit_delivery,
    validate_delivery,
)
from apps.identity.permissions import HasPermission
from apps.organization.api.viewsets.scoped import OrganizationScopedViewSet


class DeliveryViewSet(OrganizationScopedViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for DeliveryPackage."""

    selector_class = DeliverySelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": DeliveryListSerializer,
        "retrieve": DeliveryDetailSerializer,
        "create": DeliveryCreateSerializer,
        "update": DeliveryUpdateSerializer,
        "partial_update": DeliveryUpdateSerializer,
    }

    permission_map = {
        "list": (DeliveryPermissions.VIEW,),
        "retrieve": (DeliveryPermissions.VIEW,),
        "create": (DeliveryPermissions.CREATE,),
        "update": (DeliveryPermissions.UPDATE,),
        "partial_update": (DeliveryPermissions.UPDATE,),
        "destroy": (DeliveryPermissions.DELETE,),
        "add_version": (DeliveryPermissions.UPDATE,),
        "remove_version": (DeliveryPermissions.UPDATE,),
        "validate": (DeliveryPermissions.UPDATE,),
        "prepare": (DeliveryPermissions.UPDATE,),
        "submit": (DeliveryPermissions.UPDATE,),
        "approve": (DeliveryPermissions.UPDATE,),
        "reject": (DeliveryPermissions.UPDATE,),
        "complete": (DeliveryPermissions.UPDATE,),
        "cancel": (DeliveryPermissions.UPDATE,),
        "retry": (DeliveryPermissions.UPDATE,),
    }

    search_fields = ("name", "code", "client__name")
    ordering_fields = ("name", "created_at", "status")

    @staticmethod
    def _frontend_result(result):
        """Map backend status words in action result dicts to contract words."""
        if isinstance(result, dict) and "status" in result:
            result = {
                **result,
                "status": STATUS_OUTPUT_MAP.get(result["status"], result["status"]),
            }
        return result

    def get_perform_create_kwargs(self):
        user = self.request.user
        return {
            "created_by": user if user.is_authenticated else None,
        }

    @action(detail=True, methods=["post"], url_path="add-version")
    def add_version(self, request, *args, **kwargs):
        """Add a version to the delivery."""
        delivery = self.get_object()
        serializer = DeliveryAddVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        add_version_to_delivery(
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
            organization_id=str(request.organization.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="remove-version")
    def remove_version(self, request, *args, **kwargs):
        """Remove a version reference from the delivery."""
        delivery = self.get_object()
        serializer = DeliveryRemoveVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        delivery = remove_version_from_delivery(
            delivery_id=str(delivery.id),
            version_ref_id=str(serializer.validated_data["version_ref_id"]),
            organization_id=str(request.organization.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Validate delivery package contents."""
        delivery = self.get_object()
        serializer = DeliveryValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = validate_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
            organization_id=str(request.organization.id),
        )

        return Response(self._frontend_result(result))

    @action(detail=True, methods=["post"], url_path="prepare")
    def prepare(self, request, *args, **kwargs):
        """Prepare delivery package for submission."""
        delivery = self.get_object()
        serializer = DeliveryPrepareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = prepare_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
            organization_id=str(request.organization.id),
        )

        return Response(self._frontend_result(result))

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, *args, **kwargs):
        """Submit delivery to destination."""
        delivery = self.get_object()
        serializer = DeliverySubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job = BackgroundJobService.enqueue_and_run(
            job_type="export",
            organization_id=str(request.organization.id),
            description=f"Submit delivery {delivery.code or delivery.name}",
            executor=submit_delivery,
            executor_kwargs={
                "delivery_id": str(delivery.id),
                "user_id": str(request.user.id),
                "organization_id": str(request.organization.id),
            },
        )

        result = (job.result_data or {}).get("result")
        return Response(
            self._frontend_result(result or {}),
            headers={"X-Background-Job": job.job_id},
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Approve delivery by client."""
        delivery = self.get_object()
        serializer = DeliveryApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        delivery = approve_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
            client_notes=serializer.validated_data.get("client_notes", ""),
            organization_id=str(request.organization.id),
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
            user_id=str(request.user.id),
            rejection_reason=serializer.validated_data["rejection_reason"],
            organization_id=str(request.organization.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, *args, **kwargs):
        """Mark delivery as complete."""
        delivery = self.get_object()

        delivery = complete_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
            organization_id=str(request.organization.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, *args, **kwargs):
        """Cancel a delivery."""
        delivery = self.get_object()

        delivery = cancel_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
            cancellation_reason=request.data.get("cancellation_reason", ""),
            organization_id=str(request.organization.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        """Retry a delivery: reset to Prepared (frontend `retryDelivery`)."""
        delivery = self.get_object()

        delivery = retry_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
            organization_id=str(request.organization.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data)
