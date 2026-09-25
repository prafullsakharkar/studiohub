"""
Base selector for the Organization bounded context.
"""

from __future__ import annotations

from typing import Any

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
    ) -> QuerySet[Any, Any]:
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

        - An explicit organization context always scopes — including for
          superusers (a header-selected org must never leak sibling
          org rows).
        - Authenticated users are scoped to ``request.organization`` (the
          resolved ``X-Organization`` header).
        - No organization context means no rows (fail closed), except for
          superusers who retain the platform-wide break-glass listing
          (ADR-0033 D4: ``is_staff`` is not an authorization tier).
        """
        user = getattr(request, "user", None) if request is not None else None
        org = getattr(request, "organization", None) if request is not None else None

        if org is None:
            if user is not None and user.is_superuser:
                return qs
            return qs.none()

        model = qs.model
        field_names = {f.name for f in model._meta.fields}

        # Self-service carve-out (only when the caller has no membership in
        # this org): a pending invitation addressed to the caller's email
        # stays actionable without a pre-existing membership. Members use
        # normal organization scoping.
        membership = getattr(request, "membership", None)
        is_member = membership is not None

        if (
            not is_member
            and user is not None
            and user.is_authenticated
            and "email" in field_names
            and model.__name__ == "Invitation"
        ):
            return qs.filter(organization=org, email__iexact=user.email)

        # ADR-0033 D1/D6: a header-named organization is a boundary, not a
        # filter — a caller with no active membership in it sees nothing.
        if user is not None and user.is_authenticated and not user.is_superuser and not is_member:
            return qs.none()

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
