"""
Track ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.track import TrackFilter
from apps.audit.selectors.track import TrackSelector
from apps.audit.serializers.track import TrackSerializer
from apps.audit.services.track import TrackService


class TrackViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,
):
    """
    ViewSet for Track.
    """
    
    serializer_class = TrackSerializer
    service_class = TrackService
    selector_class = TrackSelector
    filter_class = TrackFilter
    
    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
