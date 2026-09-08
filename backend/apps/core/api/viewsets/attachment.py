"""
Attachment API viewsets.
"""

from rest_framework import viewsets

from apps.core.api.mixins.response import ResponseEnvelopeMixin
from apps.core.api.serializers.attachment import (
    AttachmentCreateSerializer,
    AttachmentDetailSerializer,
    AttachmentListSerializer,
    AttachmentSerializer,
    AttachmentUpdateSerializer,
)
from apps.core.models.attachment import Attachment


class AttachmentViewSet(ResponseEnvelopeMixin, viewsets.ModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    ViewSet for Attachment management.
    """

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
