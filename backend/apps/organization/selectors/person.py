"""
Person selectors.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models import Person


class PersonSelector:
    """Read-only queries for Person."""

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Person.objects.all()
