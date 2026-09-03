"""
Background Job ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.background_job import BackgroundJobFilter
from apps.audit.selectors.background_job import BackgroundJobSelector
from apps.audit.serializers.background_job import BackgroundJobSerializer
from apps.audit.services.background_job import BackgroundJobService


class BackgroundJobViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    ViewSet for BackgroundJob.
    """
    
    serializer_class = BackgroundJobSerializer
    service_class = BackgroundJobService
    selector_class = BackgroundJobSelector
    filter_class = BackgroundJobFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
