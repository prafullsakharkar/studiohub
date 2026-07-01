"""
Ownership filters.
"""

from __future__ import annotations


class OwnershipFilterMixin:
    """
    Restrict queryset to the current user.
    """

    owner_field = "created_by"

    def filter_by_owner(self, queryset, user):
        if user is None or not user.is_authenticated:
            return queryset.none()

        return queryset.filter(
            **{
                self.owner_field: user,
            }
        )
