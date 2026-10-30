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
    # The stored status, unmapped: the label in ``status`` is kept for the frontend (decision Q15).
    job_status = serializers.CharField(source="status", read_only=True)
    # The project the job belongs to, so a list can link to it and be filtered by it (CR-22).
    project_id = serializers.UUIDField(read_only=True)

    def get_status(self, obj):
        return frontend_status(obj)
    
    class Meta:
        model = PublishItem
        fields = (
            "id",
            "name",
            "code",
            "project_id",
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
            "job_status",
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
            "job_status",
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
    job_status = serializers.CharField(source="status", read_only=True)
    # The version the job exports, when it has one (CR-22).
    version_id = serializers.UUIDField(read_only=True, allow_null=True)

    def get_status(self, obj):
        return frontend_status(obj)
    
    class Meta:
        model = PublishItem
        fields = (
            "id",
            "name",
            "code",
            "version_id",
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
            "job_status",
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
            "job_status",
            "validation_results",
            "error_message",
            "retry_count",
            "created_at",
            "updated_at",
        )


class PublishCreateSerializer(serializers.Serializer[Any]):
    """
    Serializer for creating an export job.

    Everything beyond field shapes (project, version, numbering, codes) is the service's
    (``services.jobs.create_job``); this class only describes the body.
    """

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(required=True, max_length=255)
    # Blank: the server numbers it from the project (needs project_id).
    code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    project_id = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=64)
    version_id = serializers.UUIDField(required=False, allow_null=True)
    # Required unless version_id names a version of a shot or asset (checked by the service).
    entity_type = serializers.ChoiceField(choices=["Shot", "Asset"], required=False)
    entity_id = serializers.CharField(required=False, max_length=100)
    entity_code = serializers.CharField(required=False, max_length=255)
    entity_name = serializers.CharField(required=False, max_length=255)
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
        from apps.publishing.services.jobs import create_job

        request = self.context.get("request")
        return create_job(
            actor=getattr(request, "user", None), data=validated_data, request=request
        )


class PublishUpdateSerializer(serializers.Serializer[Any]):
    """
    Body of ``PATCH``/``PUT`` on an export job.

    Only these details can be edited, and only while the job is Pending or Failed (the service
    checks). The status, code, archive flag and retry count are not editable: sending a different
    value is a 400 "Cannot be set directly", sending the current one (an echo, as a full ``PUT``
    does) is accepted. Both the stored status and the word the API shows for it count as current.
    """

    #: field -> how to read its current value from the job
    READ_ONLY_ECHO = {
        "status": lambda job: {job.status, frontend_status(job)},
        "code": lambda job: {job.code},
        "is_archived": lambda job: {job.is_archived},
        "retry_count": lambda job: {job.retry_count},
    }

    name = serializers.CharField(required=False, max_length=255)
    dcc_tool = serializers.ChoiceField(choices=[c[0] for c in PublishItem.TOOL_CHOICES], required=False)
    dcc_version = serializers.CharField(required=False, allow_blank=True, max_length=50)
    source_file = serializers.CharField(required=False, allow_blank=True, max_length=500)
    source_version = serializers.CharField(required=False, allow_blank=True, max_length=50)
    export_path = serializers.CharField(required=False, allow_blank=True, max_length=500)
    export_format = serializers.CharField(required=False, allow_blank=True, max_length=50)
    export_options = serializers.JSONField(required=False)
    validation_rules = serializers.JSONField(required=False)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        job = self.instance
        refused = {}
        if job is not None and hasattr(data, "get"):
            for name, current in self.READ_ONLY_ECHO.items():
                if name in data and data[name] not in current(job):
                    refused[name] = ["Cannot be set directly."]
        if refused:
            raise serializers.ValidationError(refused)
        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        from apps.publishing.services.workflow import JobService

        request = self.context.get("request")
        return JobService.update(
            actor=getattr(request, "user", None), job=instance, data=validated_data
        )


class PublishValidateSerializer(serializers.Serializer[Any]):
    """The validate action takes no body."""


class PublishRepublishSerializer(serializers.Serializer[Any]):
    """Body of the republish action. The comment is noted in the audit trail; ``artist_name`` is ignored."""

    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    artist_name = serializers.CharField(required=False, allow_blank=True, max_length=255)


class PublishUnpublishSerializer(serializers.Serializer[Any]):
    """Body of the unpublish (cancel) action. ``user_name`` is ignored: the actor is the caller."""

    reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    user_name = serializers.CharField(required=False, allow_blank=True, max_length=255)


class PublishRetrySerializer(serializers.Serializer[Any]):
    """The retry action takes no body."""


class PublishFailSerializer(serializers.Serializer[Any]):
    """Body of the fail action: why the export failed (stored as the job's error message)."""

    reason = serializers.CharField(max_length=2000)
