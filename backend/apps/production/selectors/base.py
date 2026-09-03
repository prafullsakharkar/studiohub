"""
Base selector for the Production bounded context.
"""

from __future__ import annotations

from apps.core.selectors.base import BaseSelector


class ProductionBaseSelector(BaseSelector):
    """
    Base selector for Production organization-owned entities.

    Provides strict organization scoping for Project, Shot, Asset, Task,
    Timelog, Version, Review, Media, Playlist, and Workflow.

    Scoping is inherited from :class:`apps.core.selectors.base.BaseSelector`
    (``scope_by_request``) and is fail closed, applying to every user,
    including staff:

      - Rows are always filtered to the resolved request organization.
      - No organization context resolves to an empty queryset.
      - No staff/superuser bypass: the backend is authoritative and never
        exposes records belonging to another organization.
    """
