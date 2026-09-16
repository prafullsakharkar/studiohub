"""
Track ViewSet.
"""
from rest_framework import mixins

from apps.core.api.pagination import StandardPagination

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.track import TrackFilter
from apps.audit.selectors.track import TrackSelector
from apps.audit.serializers.track import TrackSerializer
from apps.audit.services.track import TrackService


class TrackViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for Track.
    """
    
    serializer_class = TrackSerializer
    service_class = TrackService
    pagination_class = StandardPagination
    selector_class = TrackSelector
    filter_class = TrackFilter
    
    search_fields = (
        "event_type", "event_name", "page_url", "page_title", "session_id",
    )

    def get_queryset(self):
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).queryset
