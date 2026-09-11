"""
Flexible organization context resolution for multi-tree viewsets.

Provides ``OrganizationContextMixin`` which resolves the tenant organization
from either:

1. ``organization_id`` URL keyword argument (nested routes
   ``/api/organizations/<org>/...``). Accepts UUID id, ``code``, ``slug``, and
   mock-dataset ids (``org-apex-01`` ...) via
   ``OrganizationSelector.resolve_by_lookup``. Unknown orgs 404. The resolved
   org + membership replace any header-derived context so selectors,
   permissions, and creates stay tenant-correct.
2. Header-derived context (flat ``/api/v1/<resource>/`` and namespaced
   ``/api/v1/organization/<resource>/`` routes). Uses the standard
   ``X-Organization-Id`` resolution, forced post-authentication.

Works with both ``OrganizationEntityViewSet`` (hook invoked by its
``perform_authentication``) and plain ``ServiceModelViewSet``-based viewsets
(hook invoked by the mixin's own ``perform_authentication`` override).
Idempotent per request via the ``_org_context_resolved`` flag.
"""

from __future__ import annotations

from typing import Any, ClassVar

from django.http import Http404

from apps.organization.middleware.organization_context import (
    resolve_organization_context as _resolve_organization_context,
)
from apps.organization.models import OrganizationMembership
from apps.organization.selectors.organization import OrganizationSelector


class OrganizationContextMixin:
    """
    Resolve the organization context post-authentication.

    Resolution order:
      1. URL ``organization_id`` kwarg (nested /api/organizations/<org>/...):
         accepts id/code/slug/mock-id via OrganizationSelector.resolve_by_lookup;
         URL org wins over headers.
      2. Header-derived context (flat + namespaced trees): the standard
         X-Organization-Id resolution, forced post-authentication.

    Idempotent per request via the ``_org_context_resolved`` flag.
    """

    organization_lookup_url_kwarg = "organization_id"
    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    kwargs: ClassVar[Any]
    request: ClassVar[Any]

    def perform_authentication(self, request):
        """Invoke after DRF authentication; idempotent on re-entry."""
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().perform_authentication(request)  # pyright: ignore[reportAttributeAccessIssue]
        self.resolve_organization_context(request)
        return response

    def resolve_organization_context(self, request):
        """
        Resolve the organization context for the current request.

        Called from ``perform_authentication``. Safe to call multiple times;
        subsequent calls no-op once ``_org_context_resolved`` is set, except
        that a nested URL ``organization_id`` lookup always wins over any
        header-derived context (even one resolved earlier by middleware).
        """
        lookup = self.kwargs.get(self.organization_lookup_url_kwarg)
        if lookup:
            # Nested tree: URL organization wins (unknown orgs 404).
            org = OrganizationSelector.resolve_by_lookup(lookup)
            if org is None:
                raise Http404("Organization not found.")

            request.organization = org
            user = getattr(request, "user", None)
            membership = None
            if user is not None and getattr(user, "is_authenticated", False):
                membership = (
                    OrganizationMembership.objects.filter(
                        user=user, organization=org, is_deleted=False
                    )
                    .select_related("role")
                    .first()
                )
            request.membership = membership
            request._org_context_resolved = True
            return

        if getattr(request, "_org_context_resolved", False):
            return

        # Flat / namespaced trees: standard header-derived context.
        _resolve_organization_context(request, force=True)