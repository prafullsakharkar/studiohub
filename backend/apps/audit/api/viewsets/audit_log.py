"""
Audit Log ViewSet.
"""
from rest_framework import mixins

from apps.audit.api.viewsets.base import AuditEntityViewSet
from apps.audit.filters.audit_log import AuditLogFilter
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.serializers.audit_log import (
    AuditLogFrontendSerializer,
    AuditLogSerializer,
)
from apps.audit.services.audit_log import AuditLogService
from apps.core.api.pagination import StandardPagination


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    AuditEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
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


class AuditCompatViewSet(AuditLogViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Flat ``GET /api/v1/audit/`` alias for the frontend AuditLogsPage.

    Same read-only queryset/selector/filter/permission stack, but serialized
    in the frontend ``AuditLog`` shape and searchable on the fields the page
    actually queries (actor name/email, entity refs, action, description).
    Mounted list-only; audit stays append-only (no POST).
    """

    serializer_class = AuditLogFrontendSerializer
    # Frontend AuditLogsPage expects the paginated envelope (the namespaced
    # resource defaults to a bare list).
    pagination_class = StandardPagination
    def get_queryset(self):
        # NOTE: the parent uses ``.queryset`` (the *unfiltered* input), which
        # silently drops FilterSet filtering on every audit viewset. The flat
        # alias must honor `?action=` etc., so it reads the filtered ``.qs``.
        queryset = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return self.filter_class(queryset, data=self.request.query_params).qs

    search_fields = (
        "action",
        "target_type",
        "target_id",
        "target_name",
        "description",
        "actor__email",
        "actor__profile__display_name",
    )
