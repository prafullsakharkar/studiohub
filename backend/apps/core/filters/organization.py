"""
Organization filters.
"""

from __future__ import annotations


class OrganizationFilterMixin:
    """
    Restrict queryset by organization.
    """

    organization_field = "organization"

    def filter_by_organization(self, queryset, organization):
        if organization is None:
            return queryset

        return queryset.filter(
            **{
                self.organization_field: organization,
            }
        )
