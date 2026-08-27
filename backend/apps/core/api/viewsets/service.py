"""
Declarative service-driven ViewSet.
"""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

from ..mixins.service import ServiceMixin
from .generic import BaseModelViewSet


class ServiceModelViewSet(
    ServiceMixin,
    BaseModelViewSet,
):
    """
    Declarative ViewSet.

    Applications configure:

        selector_class
        service_class
        serializer_map
        permission_map

    Business logic lives in Services.
    Read logic lives in Selectors.
    """

    selector_class = None
    service_class = None

    serializer_map = {}

    permission_map = {}

    default_serializer_class = None

    def get_selector(self):
        """
        Return the configured selector.
        """
        if self.selector_class is None:
            raise ImproperlyConfigured(f"{self.__class__.__name__} must define selector_class.")

        return self.selector_class

    def get_queryset(self):
        """
        Delegate queryset construction to the selector.
        """
        selector = self.get_selector()

        return selector.get_queryset(
            request=self.request,
            view=self,
        )

    def get_serializer_class(self):
        """
        Resolve serializer by action.
        """

        # ``action`` is only set during request dispatch; schema generation
        # introspects the view without one.
        action = getattr(self, "action", None)
        serializer = self.serializer_map.get(action)

        if serializer:
            return serializer

        if self.default_serializer_class:
            return self.default_serializer_class

        if self.serializer_map and (action is None or action not in self.serializer_map):
            # Schema generation (drf-spectacular) resolves serializers for
            # every operation, including actions without a mapped serializer
            # (e.g. ``destroy``, custom ``@action`` methods) and before
            # dispatch (no action set). Fall back to the primary mapped
            # serializer so OpenAPI introspection can succeed; runtime
            # behavior for mapped actions is unchanged.
            preferred = self.serializer_map.get("list")
            return preferred or next(iter(self.serializer_map.values()))

        return super().get_serializer_class()
