"""
Background Job ViewSet.
"""
from rest_framework import mixins
from rest_framework.decorators import action

from apps.core.api.pagination import StandardPagination

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.background_job import BackgroundJobFilter
from apps.audit.selectors.background_job import BackgroundJobSelector
from apps.audit.serializers.background_job import BackgroundJobSerializer
from apps.audit.services.background_job import BackgroundJobService


class BackgroundJobViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for BackgroundJob.
    """
    
    serializer_class = BackgroundJobSerializer
    service_class = BackgroundJobService
    pagination_class = StandardPagination
    selector_class = BackgroundJobSelector
    filter_class = BackgroundJobFilter
    
    search_fields = (
        "job_id", "job_type", "description", "worker_id", "queue_name",
    )

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset

    @action(detail=True, methods=["post"])
    def retry(self, request, *args, **kwargs):
        """Re-queue a background job."""
        from rest_framework.response import Response

        instance = self.get_object()
        job = self.service_class.retry_job(instance)
        return Response(self.get_serializer(job).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, *args, **kwargs):
        """Cancel a background job."""
        from rest_framework.response import Response

        instance = self.get_object()
        job = self.service_class.cancel_job(instance)
        return Response(self.get_serializer(job).data)
