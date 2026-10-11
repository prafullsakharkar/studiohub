"""
CalendarEvent selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from apps.organization.models import CalendarEvent

from .base import OrganizationBaseSelector


class CalendarEventSelector(OrganizationBaseSelector):
    """
    Read-only queries for CalendarEvent.
    """

    model = CalendarEvent

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ):
        return CalendarEvent.objects.active().select_related(
            "organization",
        )
