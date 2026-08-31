"""
Publishing serializers.
"""
from rest_framework import serializers

from apps.publishing.models import PublishItem, PublishValidationRule


class PublishListSerializer(serializers.ModelSerializer):
    """Serializer for publish list view."""
    
    client_name = serializers.CharField(source="project.name", read_only=True)
    entity_type_display = serializers.CharField(source="get_entity_type_display", read_only=True)
    dcc_tool_display = serializers.CharField(source="get_dcc_tool_display", read_only=True)
    
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


class PublishDetailSerializer(serializers.ModelSerializer):
    """Serializer for publish detail view."""
    
    project = serializers.UUIDField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    entity_type_display = serializers.CharField(source="get_entity_type_display", read_only=True)
    dcc_tool_display = serializers.CharField(source="get_dcc_tool_display", read_only=True)
    
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


class PublishCreateSerializer(serializers.Serializer):
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
        choices=[
            "Maya", "Houdini", "Blender", "Nuke", "Maya Light", "Cinema 4D", "3ds Max"
        ],
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


class PublishUpdateSerializer(serializers.Serializer):
    """Serializer for updating a publish."""
    
    name = serializers.CharField(required=False, max_length=255)
    export_path = serializers.CharField(required=False, allow_blank=True, max_length=500)
    export_format = serializers.CharField(required=False, allow_blank=True, max_length=50)


class PublishValidateSerializer(serializers.Serializer):
    """Serializer for validating a publish."""
    
    def validate(self, data):
        """Validate the publish."""
        return data


class PublishRepublishSerializer(serializers.Serializer):
    """Serializer for republishing."""
    
    def validate(self, data):
        """Validate the republish."""
        return data


class PublishUnpublishSerializer(serializers.Serializer):
    """Serializer for unpublishing."""
    
    def validate(self, data):
        """Validate the unpublish."""
        return data


class PublishRetrySerializer(serializers.Serializer):
    """Serializer for retrying a publish."""
    
    def validate(self, data):
        """Validate the retry."""
        return data
