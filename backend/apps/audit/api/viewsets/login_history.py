"""
Login History ViewSet.
"""
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.login_history import LoginHistoryFilter
from apps.audit.models.login_history import LoginHistory
from apps.audit.selectors.login_history import LoginHistorySelector
from apps.audit.serializers.login_history import LoginHistorySerializer
from apps.audit.services.login_history import LoginHistoryService


class LoginHistoryViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    Read-only ViewSet for LoginHistory.

    Login history is written by the identity service during
    authentication; the API only exposes it for audit review.
    """
    
    serializer_class = LoginHistorySerializer
    service_class = LoginHistoryService
    selector_class = LoginHistorySelector
    filter_class = LoginHistoryFilter
    ordering = ("-created_at",)
    search_fields = ("user__email", "status", "login_type")
    ordering_fields = ("created_at", "updated_at")
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
