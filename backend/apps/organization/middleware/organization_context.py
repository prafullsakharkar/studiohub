"""
Organization context middleware.

Resolves the ``X-Organization`` header (set as a raw value by
``apps.core.middleware.OrganizationMiddleware``) into an ``Organization``
instance and the authenticated user's ``OrganizationMembership`` within it,
exposing them on the request as ``request.organization`` and
``request.membership``.

DRF authenticates the user inside the view (not in middleware), so the
resolution is exposed as a reusable function that the Organization viewset
bases call from ``initial()`` — after authentication, before permission
checks. The middleware itself calls it too, so the context is available
wherever the request flows through the full stack (e.g. DRF ``initial``
already having run is a no-op thanks to caching on the request).

Keeping the header → instance resolution in the Organization app (rather than
core) preserves core's domain neutrality.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError


def resolve_organization_context(request, *, force=False):
    """
    Resolve the current organization context onto the request.

    Sets ``request.organization`` (Organization instance or ``None``) and
    ``request.membership`` (the user's membership in that org, or ``None``).

    Resolution runs at most once per request (cached on ``_org_context_resolved``)
    unless ``force=True`` is passed — the org viewset bases re-resolve after
    DRF authentication has set ``request.user``.
    """
    if getattr(request, "_org_context_resolved", False) and not force:
        return request.organization

    request.organization = None
    request.membership = None

    org_ref = (
        getattr(request, "organization", None)
        or request.headers.get("X-Organization")
        or request.headers.get("X-Organization-Id")
    )

    user = getattr(request, "user", None)

    if org_ref and user is not None and user.is_authenticated:
        Organization = _organization_model()
        OrganizationMembership = _membership_model()

        org = None
        try:
            org = Organization.objects.filter(
                id=org_ref,
                is_deleted=False,
            ).first()
        except (ValidationError, ValueError, TypeError):
            # Malformed organization identifier (e.g. a non-UUID header
            # value): resolve to no organization context (fail closed)
            # instead of raising a server error.
            org = None

        if org is not None:
            request.organization = org
            request.membership = (
                OrganizationMembership.objects.filter(
                    user=user,
                    organization=org,
                    is_deleted=False,
                ).first()
            )

    request._org_context_resolved = True

    return request.organization


class OrganizationContextMiddleware:
    """
    Resolve the current organization context onto the request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        resolve_organization_context(request)

        return self.get_response(request)


def _organization_model():
    from apps.organization.models.organization import Organization

    return Organization


def _membership_model():
    from apps.organization.models.membership import (
        OrganizationMembership,
    )

    return OrganizationMembership
