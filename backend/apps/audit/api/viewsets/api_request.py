"""
API Request ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.constants.permissions import AuditPermissions
from apps.audit.filters.api_request import APIRequestFilter
from apps.audit.selectors.api_request import APIRequestSelector
from apps.audit.serializers.api_request import APIRequestSerializer
from apps.audit.services.api_request import APIRequestService
from apps.core.api.pagination import StandardPagination


class APIRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for APIRequest.
    """
    
    serializer_class = APIRequestSerializer

    # Reads require the audit.view permission (seeded to production-tier
    # roles); audit rows are platform-global, not open to every user.
    permission_map = {
        "list": (AuditPermissions.VIEW,),
        "retrieve": (AuditPermissions.VIEW,),
    }
    service_class = APIRequestService
    pagination_class = StandardPagination
    selector_class = APIRequestSelector
    filter_class = APIRequestFilter
    
    search_fields = (
        "path", "method", "user__email", "ip_address",
    )

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).qs
