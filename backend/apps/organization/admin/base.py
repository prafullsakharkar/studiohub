"""
Shared Django admin base classes for organization-aware models.

``OrganizationScopedAdminMixin`` enforces the multi-tenant boundary inside
Django Admin: non-superuser staff only ever see rows belonging to
organizations they are members of (fail closed). Superusers keep global
access per the existing permission architecture.
"""

from __future__ import annotations

from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.organization.models.membership import OrganizationMembership
from apps.organization.models.organization import Organization


class OrganizationScopedAdminMixin(admin.ModelAdmin):
    """
    Scope admin rows (and the organization dropdown) to the staff user's
    own organizations.

    Configure per model when the organization link is not a direct
    ``organization`` FK:

    * ``organization_lookup`` — ORM path to the organization
      (e.g. ``"role__organization"`` for junction tables).
    * ``include_null_organization`` — also show rows with no organization
      (e.g. global system roles).
    """

    organization_lookup = "organization"
    include_null_organization = False

    def _user_organization_ids(self, request):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return []
        if user.is_superuser:
            return None
        return list(
            OrganizationMembership.objects.filter(user=user).values_list(
                "organization_id", flat=True
            )
        )

    def _scoped(self, qs, org_ids):
        lookup = self.organization_lookup
        scoped = qs.filter(**{f"{lookup}__in": org_ids})
        if self.include_null_organization:
            scoped = scoped | qs.filter(**{f"{lookup}__isnull": True})
        return scoped

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        org_ids = self._user_organization_ids(request)
        if org_ids is None:
            return qs
        return self._scoped(qs, org_ids)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "organization" and not request.user.is_superuser:
            kwargs["queryset"] = Organization.objects.filter(
                id__in=self._user_organization_ids(request)
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


class OrganizationScopedModelAdmin(OrganizationScopedAdminMixin, StudioHubModelAdmin):
    """
    Ready-to-use admin base for directly organization-owned models.
    """

    pass


__all__ = [
    "OrganizationScopedAdminMixin",
    "OrganizationScopedModelAdmin",
]
