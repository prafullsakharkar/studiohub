"""
Declarative service-driven ViewSet.
"""

from __future__ import annotations

from rest_framework.exceptions import ImproperlyConfigured

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
            raise ImproperlyConfigured(
                f"{self.__class__.__name__} must define selector_class."
            )

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

        serializer = self.serializer_map.get(self.action)

        if serializer:
            return serializer

        if self.default_serializer_class:
            return self.default_serializer_class

        return super().get_serializer_class()
