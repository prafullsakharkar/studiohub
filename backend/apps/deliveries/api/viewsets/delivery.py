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
from apps.deliveries.api.viewsets.base import PlatformCrudViewSet
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.selectors.delivery import DeliverySelector
from apps.deliveries.services.delivery import (
    approve_delivery,
    cancel_delivery,
    complete_delivery,
    prepare_delivery,
    reject_delivery,
    retry_delivery,
    submit_delivery,
    validate_delivery,
)
from apps.deliveries.services.package import DeliveryService
from apps.identity.permissions import HasPermission


class DeliveryViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
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

    def _detail(self, package):
        """The detail shape of ``package``, read fresh so its items and files are included."""
        fresh = DeliverySelector.get_queryset(request=self.request).get(pk=package.pk)
        return DeliveryDetailSerializer(fresh, context=self.get_serializer_context()).data

    def update(self, request, *args, **kwargs):
        """Edit a delivery's details (only before it is sent); answers with the detail shape."""
        partial = kwargs.pop("partial", False)
        delivery = self.get_object()
        serializer = DeliveryUpdateSerializer(
            delivery, data=request.data, partial=partial, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        delivery = serializer.save()
        return Response(self._detail(delivery))

    @action(detail=True, methods=["post"], url_path="add-version")
    def add_version(self, request, *args, **kwargs):
        """Add a published version of the delivery's project; its files come from the registry."""
        delivery = self.get_object()
        serializer = DeliveryAddVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.add_version(
            actor=request.user,
            package=delivery,
            version_id=serializer.validated_data["version_id"],
        )

        return Response(self._detail(delivery), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="remove-version")
    def remove_version(self, request, *args, **kwargs):
        """Remove an item (by ``item_id``, or the older integer ``version_ref_id``)."""
        delivery = self.get_object()
        serializer = DeliveryRemoveVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = serializer.validated_data.get("item_id") or serializer.validated_data["version_ref_id"]

        DeliveryService.remove_version(actor=request.user, package=delivery, item_key=key)

        return Response(self._detail(delivery))

    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Validate delivery package contents."""
        delivery = self.get_object()
        serializer = DeliveryValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = validate_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
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
            description=f"Submit delivery {delivery.code or delivery.name}",
            executor=submit_delivery,
            executor_kwargs={
                "delivery_id": str(delivery.id),
                "user_id": str(request.user.id),
                "transfer_reference": serializer.validated_data.get("transfer_reference", ""),
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
        )

        return Response(DeliveryDetailSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, *args, **kwargs):
        """Mark delivery as complete."""
        delivery = self.get_object()

        delivery = complete_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
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
        )

        return Response(DeliveryDetailSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        """Retry a delivery: reset to Prepared (frontend `retryDelivery`)."""
        delivery = self.get_object()

        delivery = retry_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
        )

        return Response(DeliveryDetailSerializer(delivery).data)
