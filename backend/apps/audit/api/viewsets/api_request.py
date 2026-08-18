"""
API Request ViewSet.
"""
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.api_request import APIRequestFilter
from apps.audit.models.api_request import APIRequest
from apps.audit.selectors.api_request import APIRequestSelector
from apps.audit.serializers.api_request import APIRequestSerializer
from apps.audit.services.api_request import APIRequestService


class APIRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    ViewSet for APIRequest.
    """
    
    serializer_class = APIRequestSerializer
    service_class = APIRequestService
    selector_class = APIRequestSelector
    filter_class = APIRequestFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
