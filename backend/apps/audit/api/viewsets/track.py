"""
Track ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.track import TrackFilter
from apps.audit.selectors.track import TrackSelector
from apps.audit.serializers.track import TrackIngestSerializer, TrackSerializer
from apps.audit.services.track import TrackService
from apps.core.api.pagination import StandardPagination


class TrackViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    ViewSet for Track.
    """
    
    serializer_class = TrackSerializer

    # Reads and telemetry ingest stay open to authenticated users
    # (org-scoped selectors).
    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (),
    }
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
        return self.filter_class(queryset, data=self.request.query_params).qs

    def get_serializer_class(self):
        if self.action == "create":
            return TrackIngestSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        # Respond with the full read shape (organization_name etc.),
        # not the ingest payload shape.
        from rest_framework.response import Response

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = TrackSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=201, headers=headers)

    def perform_create(self, serializer):
        """
        Ingest one client telemetry event.

        ``user``/``organization`` always resolve server-side — client
        values are ignored per organization-isolation rules. Mock-flavored
        aliases (``track_name``, ``duration_ms``) fold into real fields.
        """
        from rest_framework.exceptions import ValidationError

        from apps.audit.validators.track import TrackValidator

        data = dict(serializer.validated_data)
        data["event_name"] = data.get("event_name") or data.pop("track_name", "")
        metadata = dict(data.get("metadata") or {})
        duration_ms = data.pop("duration_ms", None)
        if duration_ms is not None and "duration_ms" not in metadata:
            metadata["duration_ms"] = duration_ms
        data["metadata"] = metadata

        TrackValidator().validate_event_type(data.get("event_type", ""))

        user = self.request.user
        organization = getattr(self.request, "organization", None)
        if organization is None:
            raise ValidationError(
                {"organization": "Organization context is required."}
            )
        serializer.instance = self.service_class.create_track(
            user=user if user.is_authenticated else None,
            organization=organization,
            **data,
        )
