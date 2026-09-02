"""
Base selector for the Production bounded context.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class ProductionBaseSelector(BaseSelector):
    """
    Base selector for Production organization-owned entities.

    Provides strict organization scoping for Project, Shot, Asset, Task,
    Timelog, Version, Review, Media, Playlist, and Workflow.

    Scoping is fail closed and applies to every user, including staff:

      - Rows are always filtered to the resolved request organization.
      - No organization context resolves to an empty queryset.
      - No staff/superuser bypass: the backend is authoritative and never
        exposes records belonging to another organization.
    """

    @classmethod
    def scope_by_request(cls, qs, *, request=None, view=None) -> QuerySet:
        org = getattr(request, "organization", None) if request is not None else None
        if org is None:
            return qs.none()
        return qs.filter(organization=org)
