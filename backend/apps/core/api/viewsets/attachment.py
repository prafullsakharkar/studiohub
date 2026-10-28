"""
Attachment API viewsets.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.api.mixins.response import ResponseEnvelopeMixin
from apps.core.api.serializers.attachment import (
    AttachmentCreateSerializer,
    AttachmentDetailSerializer,
    AttachmentListSerializer,
    AttachmentSerializer,
    AttachmentUpdateSerializer,
)
from apps.core.logging.logger import get_logger
from apps.core.models.attachment import Attachment
from apps.core.selectors.attachment import AttachmentSelector
from apps.core.utils.client_ip import client_ip_from_meta

logger = get_logger("attachments")


class AttachmentViewSet(ResponseEnvelopeMixin, viewsets.ModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    ViewSet for Attachment management.

    A caller works only with the files they uploaded (superusers see all): the queryset comes from
    ``AttachmentSelector``, so list, retrieve, update and delete of someone else's file is a 404.
    The file itself leaves only through the signed download link in ``file`` / ``download_url``.
    """

    permission_classes = (IsAuthenticated,)

    @property
    def throttle_scope(self):
        """Uploads are rate limited per user (``upload`` in DRF's throttle rates); reads are not."""
        return "upload" if getattr(self, "action", None) == "create" else None

    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    search_fields = (
        "name",
        "description",
        "mime_type",
    )

    filterset_fields = (
        "file_type",
        "is_public",
    )

    resource_name = "Attachment"

    def get_queryset(self):
        return AttachmentSelector.get_queryset(request=self.request, view=self)

    def _log(self, event, attachment, **extra):
        logger.info(
            event,
            attachment_id=str(attachment.pk),
            user_id=str(self.request.user.pk),
            ip=client_ip_from_meta(self.request.META),
            **extra,
        )

    def perform_create(self, serializer):
        attachment = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        self._log(
            "attachment_uploaded",
            attachment,
            file_size=attachment.file_size,
            mime_type=attachment.mime_type,
        )

    def perform_update(self, serializer):
        attachment = serializer.save(updated_by=self.request.user)
        self._log("attachment_updated", attachment, fields=sorted(serializer.validated_data))

    def perform_destroy(self, instance):
        self._log("attachment_deleted", instance, file_size=instance.file_size)
        instance.delete()

    def get_serializer_class(self):
        if self.action == "list":
            return AttachmentListSerializer
        elif self.action == "retrieve":
            return AttachmentDetailSerializer
        elif self.action in ["create"]:
            return AttachmentCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return AttachmentUpdateSerializer
        return super().get_serializer_class()


class CompatAttachmentViewSet(AttachmentViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Frontend contract alias: /api/v1/attachments/ returns a bare array.

    The canonical /api/v1/core/attachments/ stays paginated; the compat
    prefix serves the AttachmentService shape (AttachmentItem[]).
    """

    pagination_class = None
