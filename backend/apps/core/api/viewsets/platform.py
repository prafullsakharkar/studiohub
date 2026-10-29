"""
Platform-scoped ViewSet base for domain applications.

Provides the shared org-free contract for platform-global entities:
no organization context resolution — querysets come from the
selector's org-free ``scope_by_request`` (project narrowing only).
"""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

from apps.core.api.viewsets.base import BaseViewSet


class PlatformScopedViewSet(BaseViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for platform-global entities: no organization context resolution."""

    selector_class = None

    def get_selector(self):
        """
        Return the configured selector.
        """
        if self.selector_class is None:
            raise ImproperlyConfigured(f"{self.__class__.__name__} must define selector_class.")

        return self.selector_class

    def get_queryset(self):
        selector = self.get_selector()
        qs = selector.get_queryset(
            request=self.request,
            view=self,
        )
        return selector.scope_by_request(
            qs,
            request=self.request,
            view=self,
        )
