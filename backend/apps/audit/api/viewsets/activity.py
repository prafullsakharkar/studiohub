"""
Activity ViewSet.
"""
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.activity import ActivityFilter
from apps.audit.models.activity import Activity
from apps.audit.selectors.activity import ActivitySelector
from apps.audit.serializers.activity import ActivitySerializer
from apps.audit.services.activity import ActivityService


class ActivityViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    ViewSet for Activity.
    """
    
    serializer_class = ActivitySerializer
    service_class = ActivityService
    selector_class = ActivitySelector
    filter_class = ActivityFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
