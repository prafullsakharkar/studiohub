"""
Delivery viewset for API endpoints.

Views stay thin: the rules (the transition map, who may sign off, QC, immutability) are in
``DeliveryService``. The permission map gates each action with the code the map names for it;
a move whose code depends on the status (cancelling a signed-off delivery) is checked again in the
service, with the request.
"""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services.background_job import BackgroundJobService
from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.deliveries.api.filtersets.delivery import DeliveryFilterSet
from apps.deliveries.api.serializers.delivery import (
    STATUS_OUTPUT_MAP,
    DeliveryAddVersionSerializer,
    DeliveryApproveSerializer,
    DeliveryBulkCancelResponseSerializer,
    DeliveryBulkCancelSerializer,
    DeliveryCancelSerializer,
    DeliveryCreateSerializer,
    DeliveryDetailSerializer,
    DeliveryListSerializer,
    DeliveryPasscodeResponseSerializer,
    DeliveryPrepareSerializer,
    DeliveryQCCheckSerializer,
    DeliveryRejectSerializer,
    DeliveryRemoveVersionSerializer,
    DeliveryReopenSerializer,
    DeliveryReviseResponseSerializer,
    DeliveryReviseSerializer,
    DeliverySignOffSerializer,
    DeliveryStatusChangeSerializer,
    DeliverySubmitSerializer,
    DeliveryUpdateSerializer,
    DeliveryValidateSerializer,
)
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.constants.workflow import DELETABLE_STATUSES
from apps.deliveries.exceptions import (
    DeliveryNotEditable,
    InvalidTransition,
    TransitionNotPermitted,
)
from apps.deliveries.models import DeliveryQCCheck
from apps.deliveries.selectors.delivery import DeliverySelector
from apps.deliveries.services.delivery import (
    prepare_delivery,
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
        "history": (DeliveryPermissions.VIEW,),
        "qc": (DeliveryPermissions.VIEW,),
        "create": (DeliveryPermissions.CREATE,),
        "update": (DeliveryPermissions.UPDATE,),
        "partial_update": (DeliveryPermissions.UPDATE,),
        "destroy": (DeliveryPermissions.DELETE,),
        "add_version": (DeliveryPermissions.UPDATE,),
        "remove_version": (DeliveryPermissions.UPDATE,),
        "validate": (DeliveryPermissions.UPDATE,),
        "prepare": (DeliveryPermissions.UPDATE,),
        "retry": (DeliveryPermissions.UPDATE,),
        "complete": (DeliveryPermissions.UPDATE,),
        "cancel": (DeliveryPermissions.UPDATE,),
        "sign_off": (DeliveryPermissions.APPROVE,),
        "reopen": (DeliveryPermissions.APPROVE,),
        "submit": (DeliveryPermissions.SEND,),
        "approve": (DeliveryPermissions.SEND,),
        "reject": (DeliveryPermissions.SEND,),
        "revise": (DeliveryPermissions.SEND,),
        "bulk_cancel": (DeliveryPermissions.UPDATE,),
        "passcode": (DeliveryPermissions.VIEW_SECRET,),
    }

    filterset_class = DeliveryFilterSet
    search_fields = ("name", "code", "client__name")
    ordering_fields = ("name", "created_at", "status")

    def perform_destroy(self, instance):
        # A delivery that was sent is the record of what the client received (SEC-DLV-04): only a draft that
        # never left, or one that was cancelled, can be deleted (CR-18).
        if instance.status not in DELETABLE_STATUSES:
            raise DeliveryNotEditable("Only a Draft or a Cancelled delivery can be deleted.")
        super().perform_destroy(instance)

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

    @extend_schema(request=DeliveryUpdateSerializer, responses={200: DeliveryDetailSerializer})
    def partial_update(self, request, *args, **kwargs):
        """Edit some details of a delivery (only before it is sent); answers with the detail shape."""
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @extend_schema(request=DeliveryUpdateSerializer, responses={200: DeliveryDetailSerializer})
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

    # -- items ---------------------------------------------------------------------------

    @extend_schema(request=DeliveryAddVersionSerializer, responses={201: DeliveryDetailSerializer})
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

    @extend_schema(
        request=DeliveryRemoveVersionSerializer, responses={200: DeliveryDetailSerializer}
    )
    @action(detail=True, methods=["post"], url_path="remove-version")
    def remove_version(self, request, *args, **kwargs):
        """Remove an item (by ``item_id``, or the older integer ``version_ref_id``)."""
        delivery = self.get_object()
        serializer = DeliveryRemoveVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = (
            serializer.validated_data.get("item_id") or serializer.validated_data["version_ref_id"]
        )

        DeliveryService.remove_version(actor=request.user, package=delivery, item_key=key)

        return Response(self._detail(delivery))

    # -- QC, prepare, sign-off, send -------------------------------------------------------

    @extend_schema(request=DeliveryValidateSerializer, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Run QC on the delivery."""
        delivery = self.get_object()
        serializer = DeliveryValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = validate_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
        )

        return Response(self._frontend_result(result))

    @extend_schema(request=None, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        """Run QC again on a Validating delivery (any other status is a 409)."""
        delivery = self.get_object()
        DeliveryService.retry(actor=request.user, package=delivery, request=request)
        return Response(self._detail(delivery))

    @extend_schema(request=DeliveryPrepareSerializer, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=["post"], url_path="prepare")
    def prepare(self, request, *args, **kwargs):
        """Prepare the delivery for sign-off: refresh the items, run QC, build the manifest."""
        delivery = self.get_object()
        serializer = DeliveryPrepareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = prepare_delivery(
            delivery_id=str(delivery.id),
            user_id=str(request.user.id),
        )

        return Response(self._frontend_result(result))

    @extend_schema(request=DeliverySignOffSerializer, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="sign-off")
    def sign_off(self, request, *args, **kwargs):
        """Internal approval (Prepared to Signed Off). Not by whoever prepared the delivery."""
        delivery = self.get_object()
        serializer = DeliverySignOffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.sign_off(
            actor=request.user,
            package=delivery,
            request=request,
            notes=serializer.validated_data.get("notes", ""),
            override_reason=serializer.validated_data.get("override_reason"),
        )

        return Response(self._detail(delivery))

    @extend_schema(request=DeliveryReopenSerializer, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, *args, **kwargs):
        """Take back a sign-off (Signed Off to Prepared)."""
        delivery = self.get_object()
        serializer = DeliveryReopenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.reopen(actor=request.user, package=delivery, request=request)

        return Response(self._detail(delivery))

    @extend_schema(request=DeliverySubmitSerializer, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, *args, **kwargs):
        """Record that a signed-off delivery was sent."""
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

    # -- the client's answer and what follows ----------------------------------------------

    @extend_schema(request=DeliveryApproveSerializer, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        """Record that the client approved (from Submitted)."""
        delivery = self.get_object()
        serializer = DeliveryApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.record_client_answer(
            actor=request.user,
            package=delivery,
            accepted=True,
            notes=serializer.validated_data.get("client_notes", ""),
            request=request,
        )

        return Response(self._detail(delivery))

    @extend_schema(request=DeliveryRejectSerializer, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        """Record that the client rejected, with the reason (from Submitted)."""
        delivery = self.get_object()
        serializer = DeliveryRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.record_client_answer(
            actor=request.user,
            package=delivery,
            accepted=False,
            reason=serializer.validated_data["rejection_reason"],
            request=request,
        )

        return Response(self._detail(delivery))

    @extend_schema(request=None, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, *args, **kwargs):
        """Mark an approved delivery as complete."""
        delivery = self.get_object()

        DeliveryService.complete(actor=request.user, package=delivery, request=request)

        return Response(self._detail(delivery))

    @extend_schema(request=DeliveryCancelSerializer, responses={200: DeliveryDetailSerializer})
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, *args, **kwargs):
        """Cancel a delivery that has not been sent."""
        delivery = self.get_object()
        serializer = DeliveryCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.cancel(
            actor=request.user,
            package=delivery,
            reason=serializer.validated_data.get("cancellation_reason", ""),
            request=request,
        )

        return Response(self._detail(delivery))

    @extend_schema(
        request=DeliveryReviseSerializer, responses={201: DeliveryReviseResponseSerializer}
    )
    @action(detail=True, methods=["post"], url_path="revise")
    def revise(self, request, *args, **kwargs):
        """Re-deliver a rejected delivery: a new Draft with the same versions."""
        delivery = self.get_object()
        serializer = DeliveryReviseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        revision, skipped = DeliveryService.revise(
            actor=request.user, package=delivery, request=request
        )

        return Response(
            {**self._detail(revision), "skipped_versions": skipped},
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=DeliveryBulkCancelSerializer,
        responses={
            200: DeliveryBulkCancelResponseSerializer,
            207: DeliveryBulkCancelResponseSerializer,
        },
    )
    @action(detail=False, methods=["post"], url_path="bulk-cancel")
    def bulk_cancel(self, request, *args, **kwargs):
        """
        Cancel up to 100 deliveries (decision Q36). Each is its own transaction, so one failing does
        not stop the rest: 200 when all succeed, 207 otherwise. A delivery that is unknown, in
        another project, or that the caller may not cancel reports the identical ``not_found``;
        the transition map is the same as for a single cancel and there is no override.
        """
        body = DeliveryBulkCancelSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        reason = body.validated_data.get("cancellation_reason", "")
        visible = DeliverySelector.get_queryset(request=request)

        results = []
        for delivery_id in body.validated_data["ids"]:
            delivery = visible.filter(pk=delivery_id).first()
            error = "not_found"
            if delivery is not None:
                try:
                    DeliveryService.cancel(
                        actor=request.user, package=delivery, reason=reason, request=request
                    )
                    error = None
                except InvalidTransition:
                    error = "invalid_transition"
                except TransitionNotPermitted:
                    error = "not_found"
            results.append({"id": str(delivery_id), "ok": error is None, "error": error})

        failed = sum(1 for result in results if not result["ok"])
        return Response(
            {
                "success": failed == 0,
                "succeeded_count": len(results) - failed,
                "failed_count": failed,
                "results": results,
            },
            status=status.HTTP_200_OK if failed == 0 else status.HTTP_207_MULTI_STATUS,
        )

    # -- reads that are not the plain detail ----------------------------------------------

    @extend_schema(request=None, responses={200: DeliveryStatusChangeSerializer(many=True)})
    @action(detail=True, methods=["get"], url_path="history", pagination_class=None)
    def history(self, request, *args, **kwargs):
        """Every status change of the delivery, oldest first."""
        delivery = self.get_object()
        rows = delivery.status_changes.select_related("actor__profile")
        return Response(DeliveryStatusChangeSerializer(rows, many=True).data)

    @extend_schema(request=None, responses={200: DeliveryQCCheckSerializer(many=True)})
    @action(detail=True, methods=["get"], url_path="qc", pagination_class=None)
    def qc(self, request, *args, **kwargs):
        """The checks of the delivery's latest QC run."""
        delivery = self.get_object()
        rows = (
            DeliveryQCCheck.objects.filter(
                delivery=delivery, run_id=delivery.qc_run_id
            ).select_related("item", "checked_by__profile")
            if delivery.qc_run_id
            else DeliveryQCCheck.objects.none()
        )
        return Response(DeliveryQCCheckSerializer(rows, many=True).data)

    @extend_schema(request=None, responses={200: DeliveryPasscodeResponseSerializer})
    @action(detail=True, methods=["get"], url_path="passcode")
    def passcode(self, request, *args, **kwargs):
        """The passcode, for a holder of ``delivery.view_secret``. Every read is audited."""
        delivery = self.get_object()
        value = DeliveryService.read_passcode(actor=request.user, package=delivery, request=request)
        return Response({"passcode": value}, headers={"Cache-Control": "no-store"})
