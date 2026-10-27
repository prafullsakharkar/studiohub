"""
Delivery viewset for API endpoints.

Views stay thin: the rules (the transition map, who may sign off, QC, immutability) are in
``DeliveryService``. The permission map gates each action with the code the map names for it;
a move whose code depends on the status (cancelling a signed-off delivery) is checked again in the
service, with the request.
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
    DeliveryCancelSerializer,
    DeliveryCreateSerializer,
    DeliveryDetailSerializer,
    DeliveryListSerializer,
    DeliveryPrepareSerializer,
    DeliveryQCCheckSerializer,
    DeliveryRejectSerializer,
    DeliveryRemoveVersionSerializer,
    DeliveryReopenSerializer,
    DeliveryReviseSerializer,
    DeliverySignOffSerializer,
    DeliveryStatusChangeSerializer,
    DeliverySubmitSerializer,
    DeliveryUpdateSerializer,
    DeliveryValidateSerializer,
)
from apps.deliveries.api.viewsets.base import PlatformCrudViewSet
from apps.deliveries.constants.permissions import DeliveryPermissions
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
        "passcode": (DeliveryPermissions.VIEW_SECRET,),
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

    # -- items ---------------------------------------------------------------------------

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

    # -- QC, prepare, sign-off, send -------------------------------------------------------

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

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        """Run QC again on a Validating delivery (any other status is a 409)."""
        delivery = self.get_object()
        DeliveryService.retry(actor=request.user, package=delivery, request=request)
        return Response(self._detail(delivery))

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

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, *args, **kwargs):
        """Take back a sign-off (Signed Off to Prepared)."""
        delivery = self.get_object()
        serializer = DeliveryReopenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DeliveryService.reopen(actor=request.user, package=delivery, request=request)

        return Response(self._detail(delivery))

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

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, *args, **kwargs):
        """Mark an approved delivery as complete."""
        delivery = self.get_object()

        DeliveryService.complete(actor=request.user, package=delivery, request=request)

        return Response(self._detail(delivery))

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

    # -- reads that are not the plain detail ----------------------------------------------

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, *args, **kwargs):
        """Every status change of the delivery, oldest first."""
        delivery = self.get_object()
        rows = delivery.status_changes.all()
        return Response(DeliveryStatusChangeSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="qc")
    def qc(self, request, *args, **kwargs):
        """The checks of the delivery's latest QC run."""
        delivery = self.get_object()
        rows = (
            DeliveryQCCheck.objects.filter(delivery=delivery, run_id=delivery.qc_run_id)
            .select_related("item")
            if delivery.qc_run_id
            else DeliveryQCCheck.objects.none()
        )
        return Response(DeliveryQCCheckSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="passcode")
    def passcode(self, request, *args, **kwargs):
        """The passcode, for a holder of ``delivery.view_secret``. Every read is audited."""
        delivery = self.get_object()
        value = DeliveryService.read_passcode(
            actor=request.user, package=delivery, request=request
        )
        return Response({"passcode": value}, headers={"Cache-Control": "no-store"})
