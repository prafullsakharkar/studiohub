"""
Organization-scoped ViewSet base for domain applications.

Provides the shared organization isolation contract used by organization
aware API surfaces outside the organization application itself:

    • The active organization is resolved right after authentication
      (header → Organization + membership) and cached on the request.
    • List/detail querysets are scoped to the active organization via the
      viewset's selector (``BaseSelector.scope_by_request``), failing
      closed when no organization context resolves.
    • Creates auto-assign the active organization.

Organization-owned entities inside this application should keep using
:class:`apps.organization.api.viewsets.base.OrganizationEntityViewSet`,
which applies the same contract through ``OrganizationBaseSelector``.
"""

from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response

from apps.core.api.viewsets.service import ServiceModelViewSet
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.models import OrganizationMembership


class OrganizationScopedViewSet(ServiceModelViewSet):
    """
    Base ViewSet for organization scoped domain entities.

    Requires ``selector_class``; scoping is applied through the selector's
    ``scope_by_request`` so selectors without a direct organization field
    can override ``scope_field`` (e.g. ``"resource__organization"``).
    """

    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    def perform_authentication(self, request):
        """
        Resolve the organization context right after authentication.

        DRF's ``initial()`` performs authentication, then runs permission
        checks. Resolving the org context here guarantees
        ``request.organization`` is available to every later step.
        """
        response = super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return response

    def get_queryset(self):
        resolve_organization_context(self.request)
        qs = super().get_queryset()
        selector = self.get_selector()
        return selector.scope_by_request(
            qs,
            request=self.request,
            view=self,
        )

    def resolve_organization(self, *, instance=None):
        """
        Resolve the active organization for a write operation.

        Order: request organization context, then the instance's
        organization, then the user's organization membership.
        """
        organization = getattr(self.request, "organization", None)
        if organization is not None:
            return organization
        if instance is not None and instance.organization_id is not None:
            return instance.organization
        user = getattr(self.request, "user", None)
        if user is not None and user.is_authenticated:
            membership = (
                OrganizationMembership.objects.filter(
                    user=user,
                    is_deleted=False,
                )
                .select_related("organization")
                .first()
            )
            if membership is not None:
                return membership.organization
        return None

    def require_organization(self, *, instance=None):
        """
        Return the active organization or raise a validation error.

        Writes must never guess an organization: without an explicit
        context the operation fails closed.
        """
        organization = self.resolve_organization(instance=instance)
        if organization is None:
            raise ValidationError(
                {"organization": "An active organization is required."}
            )
        return organization

    def get_perform_create_kwargs(self):
        """
        Extra keyword arguments for ``perform_create``.

        Subclasses override to add e.g. ``created_by``.
        """
        return {}

    def perform_create(self, serializer):
        serializer.save(
            organization=self.require_organization(),
            **self.get_perform_create_kwargs(),
        )

    def handle_exception(self, exc):
        if isinstance(exc, ValidationError):
            return Response(
                exc.message_dict,
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().handle_exception(exc)
