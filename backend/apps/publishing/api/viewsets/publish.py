"""
Publishing viewset for API endpoints.
"""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services.background_job import BackgroundJobService
from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.publish import (
    PublishCreateSerializer,
    PublishDetailSerializer,
    PublishFailSerializer,
    PublishListSerializer,
    PublishRepublishSerializer,
    PublishRetrySerializer,
    PublishUnpublishSerializer,
    PublishUpdateSerializer,
    PublishValidateSerializer,
    frontend_result_status,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.publish import PublishSelector
from apps.publishing.services.publish import (
    republish,
    retry_publish,
    unpublish,
    validate_publish,
)
from apps.publishing.services.workflow import JobService


@extend_schema_view(
    update=extend_schema(request=PublishUpdateSerializer, responses=PublishDetailSerializer),
    partial_update=extend_schema(request=PublishUpdateSerializer, responses=PublishDetailSerializer),
)
class PublishingViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for PublishItem (export jobs). Every read and write is narrowed to the caller's projects."""

    selector_class = PublishSelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": PublishListSerializer,
        "retrieve": PublishDetailSerializer,
        "create": PublishCreateSerializer,
        "update": PublishUpdateSerializer,
        "partial_update": PublishUpdateSerializer,
    }

    permission_map = {
        "list": (PublishPermissions.VIEW,),
        "retrieve": (PublishPermissions.VIEW,),
        "create": (PublishPermissions.CREATE,),
        "update": (PublishPermissions.UPDATE,),
        "partial_update": (PublishPermissions.UPDATE,),
        "destroy": (PublishPermissions.DELETE,),
        "validate": (PublishPermissions.UPDATE,),
        "republish": (PublishPermissions.UPDATE,),
        "unpublish": (PublishPermissions.UPDATE,),
        "retry": (PublishPermissions.UPDATE,),
        "start_export": (PublishPermissions.UPDATE,),
        "complete_export": (PublishPermissions.UPDATE,),
        "fail": (PublishPermissions.UPDATE,),
    }

    search_fields = ("name", "code", "entity_code", "entity_name")
    ordering_fields = ("name", "created_at", "status")

    def update(self, request, *args, **kwargs):
        """Edit a job's details (only while it is Pending or Failed); answers with the detail shape."""
        partial = kwargs.pop("partial", False)
        job = self.get_object()
        serializer = PublishUpdateSerializer(
            job, data=request.data, partial=partial, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        job = serializer.save()
        return Response(PublishDetailSerializer(job, context=self.get_serializer_context()).data)

    @extend_schema(request=PublishValidateSerializer, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, *args, **kwargs):
        """Validate publish pre-flight rules."""
        publish = self.get_object()
        serializer = PublishValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = validate_publish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )

        return Response(frontend_result_status(result))

    @extend_schema(request=PublishRepublishSerializer, responses={201: PublishDetailSerializer})
    @action(detail=True, methods=["post"], url_path="republish")
    def republish(self, request, *args, **kwargs):
        """Create new iteration of a publish."""
        publish = self.get_object()
        serializer = PublishRepublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job = BackgroundJobService.enqueue_and_run(
            job_type="export",
            description=f"Republish {getattr(publish, 'code', '') or publish.entity_name}",
            executor=republish,
            executor_kwargs={
                "publish_id": str(publish.id),
                "user_id": str(request.user.id) if request.user.is_authenticated else None,
                "comment": serializer.validated_data.get("comment", ""),
            },
        )

        result_id = (job.result_data or {}).get("result_id")
        new_publish = (
            PublishSelector.model.objects.filter(pk=result_id).first()
            if result_id
            else None
        )

        return Response(
            PublishDetailSerializer(new_publish).data,
            status=status.HTTP_201_CREATED,
            headers={"X-Background-Job": job.job_id},
        )

    @extend_schema(request=PublishUnpublishSerializer, responses=PublishDetailSerializer)
    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, *args, **kwargs):
        """Deprecate and unlink a publish."""
        publish = self.get_object()
        serializer = PublishUnpublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        publish = unpublish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
            reason=serializer.validated_data.get("reason", ""),
        )

        return Response(PublishDetailSerializer(publish).data)

    @extend_schema(request=PublishRetrySerializer, responses=PublishDetailSerializer)
    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, *args, **kwargs):
        """Re-trigger a failed publish."""
        publish = self.get_object()
        serializer = PublishRetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        publish = retry_publish(
            publish_id=str(publish.id),
            user_id=str(request.user.id) if request.user.is_authenticated else None,
        )

        return Response(PublishDetailSerializer(publish).data)

    @extend_schema(request=None, responses=PublishDetailSerializer)
    @action(detail=True, methods=["post"], url_path="start-export")
    def start_export(self, request, *args, **kwargs):
        """A pipeline tool reports that the export began (Validated to Exporting)."""
        job = JobService.start_export(actor=request.user, job=self.get_object())
        return Response(PublishDetailSerializer(job, context=self.get_serializer_context()).data)

    @extend_schema(request=None, responses=PublishDetailSerializer)
    @action(detail=True, methods=["post"], url_path="complete-export")
    def complete_export(self, request, *args, **kwargs):
        """The export finished (Exporting to Exported, final). No file is required."""
        job = JobService.complete_export(actor=request.user, job=self.get_object())
        return Response(PublishDetailSerializer(job, context=self.get_serializer_context()).data)

    @extend_schema(request=PublishFailSerializer, responses=PublishDetailSerializer)
    @action(detail=True, methods=["post"], url_path="fail")
    def fail(self, request, *args, **kwargs):
        """The export failed (Exporting to Failed); the reason is stored as the error message."""
        body = PublishFailSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        job = JobService.fail(
            actor=request.user, job=self.get_object(), reason=body.validated_data["reason"]
        )
        return Response(PublishDetailSerializer(job, context=self.get_serializer_context()).data)
