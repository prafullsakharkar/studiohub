"""
Attachment API serializers.
"""

import uuid

from rest_framework import serializers

from apps.core.models.attachment import Attachment


class AttachmentSerializer(serializers.ModelSerializer):
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
