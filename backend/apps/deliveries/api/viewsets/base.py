"""
Shared platform-global viewset bases for the de-orged domain apps.

``PlatformReadViewSet`` and ``PlatformCrudViewSet`` implement the org-free
URL / serializer / soft-delete contract the former org-scoped base provided.
They are defined once here (rather than per-app) so every de-orged app shares
identical behavior; concrete viewsets configure ``selector_class``,
``serializer_map`` and ``permission_map`` on top.
"""

from __future__ import annotations

from rest_framework import mixins

from apps.core.api.viewsets.platform import PlatformScopedViewSet


class PlatformReadViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    PlatformScopedViewSet,
):
    """Platform-global reads (org-free).

    ``serializer_map`` (action -> serializer) mirrors the declarative
    contract of the former org-scoped base so viewsets keep resolving
    serializers per action without a global ``serializer_class``.
    """

    # Same URL contract as the former org-scoped base: ``uuid`` kwarg
    # resolving against the ``id`` primary key.
    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    serializer_map = {}

    def get_serializer_class(self):
        action = getattr(self, "action", None)
        serializer = self.serializer_map.get(action)
        if serializer:
            return serializer
        if self.serializer_map and (action is None or action not in self.serializer_map):
            # Schema generation (drf-spectacular) introspects operations
            # before dispatch (no action set) and for unmapped actions;
            # fall back to the primary mapped serializer so OpenAPI can
            # resolve. Runtime behavior for mapped actions is unchanged.
            preferred = self.serializer_map.get("list")
            return preferred or next(iter(self.serializer_map.values()))
        return super().get_serializer_class()


class PlatformCrudViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    """Platform-global CRUD (org-free).

    Querysets come from the selector's org-free reads. Destroy honors
    the Core soft-delete contract (same as the former org-scoped base).
    """

    # Same URL contract as the former org-scoped base: ``uuid`` kwarg
    # resolving against the ``id`` primary key.
    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    serializer_map = {}

    def get_serializer_class(self):
        action = getattr(self, "action", None)
        serializer = self.serializer_map.get(action)
        if serializer:
            return serializer
        if self.serializer_map and (action is None or action not in self.serializer_map):
            # Schema generation (drf-spectacular) introspects operations
            # before dispatch (no action set) and for unmapped actions;
            # fall back to the primary mapped serializer so OpenAPI can
            # resolve. Runtime behavior for mapped actions is unchanged.
            preferred = self.serializer_map.get("list")
            return preferred or next(iter(self.serializer_map.values()))
        return super().get_serializer_class()

    def perform_destroy(self, instance):
        from apps.core.services.soft_delete import SoftDeleteService

        if hasattr(instance, "is_deleted"):
            SoftDeleteService.delete(
                instance,
                user=getattr(self.request, "user", None),
            )
        else:
            instance.delete()
