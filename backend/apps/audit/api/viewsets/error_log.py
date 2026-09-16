"""
Error Log ViewSet.
"""
from rest_framework import mixins

from apps.core.api.pagination import StandardPagination
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.error_log import ErrorLogFilter
from apps.audit.selectors.error_log import ErrorLogSelector
from apps.audit.serializers.error_log import ErrorLogSerializer
from apps.audit.services.error_log import ErrorLogService


class ErrorLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for ErrorLog.
    """
    
    serializer_class = ErrorLogSerializer
    service_class = ErrorLogService
    pagination_class = StandardPagination
    selector_class = ErrorLogSelector
    filter_class = ErrorLogFilter
    
    search_fields = (
        "message", "error_type", "error_code", "request_path",
    )

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
    
    @action(detail=True, methods=["post"])
    def resolve(self, request, *args, **kwargs):
        """
        Resolve an error log.
        """
        instance = self.get_object()
        self.service_class.resolve_error(instance, request.user)
        return Response({"status": "resolved"})
