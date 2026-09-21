"""
Publishing serializers.
"""
from typing import Any

from rest_framework import serializers

from apps.publishing.models import PublishItem

# Backend status -> frontend contract words (types/publishing.ts
# PublishStatus). DB keeps backend words; only the read shape is mapped.
# Archived items (via unpublish) read as Unpublished.
STATUS_OUTPUT_MAP = {
    PublishItem.STATUS_PENDING: "Queued",
    PublishItem.STATUS_VALIDATING: "Validating",
    PublishItem.STATUS_VALIDATED: "Published",
    PublishItem.STATUS_EXPORTING: "Publishing",
    PublishItem.STATUS_EXPORTED: "Published",
    PublishItem.STATUS_FAILED: "Failed",
    PublishItem.STATUS_CANCELLED: "Unpublished",
}


def frontend_status(item):
    """Map a PublishItem to its frontend contract status word."""
    if item.is_archived:
        return "Unpublished"
    return STATUS_OUTPUT_MAP.get(item.status, item.status)


def frontend_result_status(result):
    """Map backend status words in action result dicts to contract words."""
    if isinstance(result, dict) and "status" in result:
        return {
            **result,
            "status": STATUS_OUTPUT_MAP.get(result["status"], result["status"]),
        }
    return result


class PublishListSerializer(serializers.ModelSerializer[PublishItem]):
    """Serializer for publish list view."""

    client_name = serializers.CharField(source="project.name", read_only=True)
    entity_type_display = serializers.CharField(source="get_entity_type_display", read_only=True)
    dcc_tool_display = serializers.CharField(source="get_dcc_tool_display", read_only=True)
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        return frontend_status(obj)
    
    class Meta:
        model = PublishItem
        fields = (
            "id",
            "name",
            "code",
            "entity_type",
            "entity_type_display",
            "entity_code",
            "entity_name",
            "dcc_tool",
            "dcc_tool_display",
            "dcc_version",
            "source_file",
            "export_path",
            "export_format",
            "status",
            "is_success",
            "is_failed",
            "retry_count",
            "client_name",
            "is_archived",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "code",
            "status",
            "is_success",
            "is_failed",
            "retry_count",
            "created_at",
            "updated_at",
        )


class PublishDetailSerializer(serializers.ModelSerializer[PublishItem]):
    """Serializer for publish detail view."""
    
    project = serializers.UUIDField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    entity_type_display = serializers.CharField(source="get_entity_type_display", read_only=True)
    dcc_tool_display = serializers.CharField(source="get_dcc_tool_display", read_only=True)
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        return frontend_status(obj)
    
    class Meta:
        model = PublishItem
        fields = (
            "id",
            "name",
            "code",
            "entity_type",
            "entity_type_display",
            "entity_id",
            "entity_code",
            "entity_name",
            "dcc_tool",
            "dcc_tool_display",
            "dcc_version",
            "source_file",
            "source_version",
            "export_path",
            "export_format",
            "status",
            "validation_rules",
            "validation_results",
            "export_options",
            "error_message",
            "retry_count",
            "is_archived",
            "project",
            "project_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "code",
            "status",
            "validation_results",
            "error_message",
            "retry_count",
            "created_at",
            "updated_at",
        )


class PublishCreateSerializer(serializers.Serializer[Any]):
    """Serializer for creating a publish."""
    
    name = serializers.CharField(required=True, max_length=255)
    code = serializers.CharField(required=True, max_length=50)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    entity_type = serializers.ChoiceField(
        choices=["Shot", "Asset"],
        required=True,
    )
    entity_id = serializers.CharField(required=True, max_length=100)
    entity_code = serializers.CharField(required=True, max_length=255)
    entity_name = serializers.CharField(required=True, max_length=255)
    dcc_tool = serializers.ChoiceField(
        choices=[c[0] for c in PublishItem.TOOL_CHOICES],
        required=True,
    )
    dcc_version = serializers.CharField(required=False, allow_blank=True, max_length=50)
    source_file = serializers.CharField(required=False, allow_blank=True, max_length=500)
    source_version = serializers.CharField(required=False, allow_blank=True, max_length=50)
    export_path = serializers.CharField(required=False, allow_blank=True, max_length=500)
    export_format = serializers.CharField(required=False, allow_blank=True, max_length=50)

    def create(self, validated_data):
        """Create a publish item."""
        from apps.publishing.models import PublishItem

        organization = validated_data.pop("organization")
        created_by = validated_data.pop("created_by", None)
        return PublishItem.objects.create(
            organization=organization,
            created_by=created_by,
            **validated_data,
        )


class PublishUpdateSerializer(serializers.Serializer[Any]):
    """Serializer for updating a publish."""
    
    name = serializers.CharField(required=False, max_length=255)
    export_path = serializers.CharField(required=False, allow_blank=True, max_length=500)
    export_format = serializers.CharField(required=False, allow_blank=True, max_length=50)


class PublishValidateSerializer(serializers.Serializer[Any]):
    """Serializer for validating a publish."""
    
    def validate(self, data):
        """Validate the publish."""
        return data


class PublishRepublishSerializer(serializers.Serializer[Any]):
    """Serializer for republishing."""
    
    def validate(self, data):
        """Validate the republish."""
        return data


class PublishUnpublishSerializer(serializers.Serializer[Any]):
    """Serializer for unpublishing."""
    
    def validate(self, data):
        """Validate the unpublish."""
        return data


class PublishRetrySerializer(serializers.Serializer[Any]):
    """Serializer for retrying a publish."""
    
    def validate(self, data):
        """Validate the retry."""
        return data
