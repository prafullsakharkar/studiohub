from __future__ import annotations


class OrganizationQuerySetMixin:

    def organization(self, organization):
        return self.filter(organization=organization)
