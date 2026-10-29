"""
Change Log ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.constants.permissions import AuditPermissions
from apps.audit.filters.change_log import ChangeLogFilter
from apps.audit.selectors.change_log import ChangeLogSelector
from apps.audit.serializers.change_log import ChangeLogSerializer
from apps.audit.services.change_log import ChangeLogService
from apps.core.api.pagination import StandardPagination


class ChangeLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for ChangeLog.
    """
    
    serializer_class = ChangeLogSerializer

    # Reads require the audit.view permission (seeded to production-tier
    # roles); audit rows are platform-global, not open to every user.
    permission_map = {
        "list": (AuditPermissions.VIEW,),
        "retrieve": (AuditPermissions.VIEW,),
    }
    service_class = ChangeLogService
    pagination_class = StandardPagination
    selector_class = ChangeLogSelector
    filter_class = ChangeLogFilter
    
    search_fields = (
        "target_type", "target_name", "description",
    )

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).qs
