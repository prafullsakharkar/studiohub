"""
Organization filter base classes.
"""

from apps.core.filters.base import BaseFilterSet


class OrganizationBaseFilterSet(BaseFilterSet):
    """
    Base filter set for the Organization module.
    """

    class Meta:
        abstract = True
