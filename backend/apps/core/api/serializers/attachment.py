"""
Attachment API serializers.
"""

import mimetypes
import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.core.models.attachment import Attachment
from apps.core.services import attachment_links
from apps.core.validators.attachment import AttachmentValidator


class AttachmentSerializer(serializers.ModelSerializer[Attachment]):
    """
    Base serializer for Attachment.
    """

    class Meta:
        model = Attachment
        fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "file",
            "name",
            "description",
            "file_type",
            "mime_type",
            "file_size",
            "storage_key",
            "is_public",
            "expires_at",
            "created_by",
            "updated_by",
            "deleted_by",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "file_size",
            "storage_key",
            "created_by",
            "updated_by",
            "deleted_by",
        )

    def to_representation(self, instance):
        """
        Never expose the stored path: ``file`` becomes a short-lived download link for the caller.

        Without an authenticated caller in the context there is no link, and ``file`` is dropped.
        """
        data = super().to_representation(instance)

        request = self.context.get("request")
        user = getattr(request, "user", None)
        has_file = bool(instance.file)

        link = None
        if has_file and getattr(user, "is_authenticated", False):
            link = attachment_links.download_path(instance, user)

        data["file"] = link
        data["download_url"] = link
        return data


class AttachmentListSerializer(AttachmentSerializer):
    """
    Serializer for Attachment list.
    """

    class Meta(AttachmentSerializer.Meta):
        pass


class AttachmentDetailSerializer(AttachmentSerializer):
    """
    Serializer for Attachment detail.
    """

    class Meta(AttachmentSerializer.Meta):
        pass


class AttachmentCreateSerializer(AttachmentSerializer):
    """
    Serializer for Attachment creation.
    """

    file = serializers.FileField(
        required=False,
        allow_null=True,
    )

    def validate_file(self, value):
        if value is None:
            return value
        request = self.context.get("request")
        user = getattr(request, "user", None)

        try:
            AttachmentValidator.validate_upload(value)
            AttachmentValidator.validate_quota(
                user if getattr(user, "is_authenticated", False) else None, value.size
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error
        return value

    class Meta(AttachmentSerializer.Meta):
        fields = tuple(
            f
            for f in AttachmentSerializer.Meta.fields
            if f
            not in (
                "id",
                "uuid",
                "created_at",
                "updated_at",
                "file_size",
                "storage_key",
                "created_by",
                "updated_by",
                "deleted_by",
            )
        )

    def create(self, validated_data):
        """
        Generate a storage key when one is not provided.

        ``storage_key`` is a required, unique DB column but is excluded from
        the write serializer, so it must be defaulted here.
        """
        validated_data.setdefault(
            "storage_key",
            str(uuid.uuid4()),
        )

        # Size and type come from the uploaded file, never from the client.
        upload = validated_data.get("file")
        if upload:
            validated_data["file_size"] = int(upload.size)
            validated_data["mime_type"] = (
                mimetypes.guess_type(upload.name)[0] or "application/octet-stream"
            )

        return super().create(validated_data)


class AttachmentUpdateSerializer(AttachmentSerializer):
    """
    Serializer for Attachment update.
    """

    class Meta(AttachmentSerializer.Meta):
        fields = (
            "name",
            "description",
            "file_type",
            "is_public",
            "expires_at",
        )
