"""
Base selector for the Organization bounded context.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class OrganizationBaseSelector(BaseSelector):
    """
    Base selector for the Organization domain.

    Shared read logic for:

        - Organization
        - Department
        - Team
        - Membership
        - Office
        - Invitation
    """

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Applications must override this.
        """
        raise NotImplementedError

    @classmethod
    def for_organization(
        cls,
        organization,
    ):
        return cls.filter(
            organization=organization,
        )

    @classmethod
    def scope_by_request(cls, qs, *, request=None, view=None):
        """
        Scope an organization-owned queryset to the request's organization.

        - Staff/superusers see everything (admin context).
        - Authenticated users are scoped to ``request.organization`` (the
          resolved ``X-Organization`` header).
        - No organization context means no rows (fail closed).
        """
        user = getattr(request, "user", None) if request is not None else None

        if user is not None and (user.is_staff or user.is_superuser):
            return qs

        org = getattr(request, "organization", None) if request is not None else None

        if org is None:
            return qs.none()

        model = qs.model
        field_names = {f.name for f in model._meta.fields}

        if "organization" in field_names:
            return qs.filter(organization=org)

        # Junction / related models without a direct organization FK.
        if "group" in field_names and hasattr(model, "group"):
            return qs.filter(group__organization=org)
        if "role" in field_names and hasattr(model, "role"):
            return qs.filter(role__organization=org)
        if "user" in field_names and hasattr(model, "user"):
            return qs.filter(user__organization_memberships__organization=org)

        return qs.none()

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        return cls.get_queryset().inactive()
