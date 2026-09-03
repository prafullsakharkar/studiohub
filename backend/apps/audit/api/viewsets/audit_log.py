"""
Audit Log ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.audit_log import AuditLogFilter
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.serializers.audit_log import AuditLogSerializer
from apps.audit.services.audit_log import AuditLogService


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    Read-only ViewSet for AuditLog.

    Audit records are append-only and protected from modification;
    they are written by internal services, not through the API.
    """
    
    serializer_class = AuditLogSerializer
    service_class = AuditLogService
    selector_class = AuditLogSelector
    filter_class = AuditLogFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
