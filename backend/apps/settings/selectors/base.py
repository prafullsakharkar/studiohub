"""
Base selector for the Settings bounded context.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class SettingsBaseSelector(BaseSelector):
    """
    Base selector for the Settings domain.

    Shared read logic for:

        - SystemSettings
        - EmailSettings
        - NotificationSettings
    """

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet[Any, Any]:
        """
        Applications must override this.
        """
        raise NotImplementedError

    @classmethod
    def _scope_by_request(
        cls,
        queryset: QuerySet[Any, Any],
        request=None,
    ) -> QuerySet[Any, Any]:
        """
        Platform-global settings visibility (org-free).

        Settings carry no tenant partition: every authenticated caller
        sees the platform-wide rows; anonymous callers see nothing.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        return queryset

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        return cls.get_queryset().inactive()
