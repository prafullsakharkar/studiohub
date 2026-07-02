"""
Organization statistics selectors.
"""

from __future__ import annotations

from apps.organization.models import Organization


def list_organizations_with_statistics():
    """
    Return organizations with statistics.
    """
    return Organization.objects.with_statistics().ordered()


def get_organization_statistics(pk):
    """
    Single organization statistics.
    """
    return Organization.objects.with_statistics().get(pk=pk)
