"""
Change Log ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.change_log import ChangeLogFilter
from apps.audit.selectors.change_log import ChangeLogSelector
from apps.audit.serializers.change_log import ChangeLogSerializer
from apps.audit.services.change_log import ChangeLogService


class ChangeLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    ViewSet for ChangeLog.
    """
    
    serializer_class = ChangeLogSerializer
    service_class = ChangeLogService
    selector_class = ChangeLogSelector
    filter_class = ChangeLogFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
