"""Organization membership filtersets."""

from __future__ import annotations

import django_filters

from apps.organization.models.membership import OrganizationMembership


class OrganizationMembershipFilterSet(django_filters.FilterSet):
    """FilterSet for OrganizationMembership model."""

    class Meta:
        model = OrganizationMembership
        fields = {
            "id": ["exact"],
            "status": ["exact"],
            "role": ["exact"],
        }
