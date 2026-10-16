"""
Base selector for the Audit bounded context.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector


class AuditBaseSelector(BaseSelector):
    """
    Base selector for the Audit domain.

    Shared read logic for:

        - AuditLog
        - AuditTrail
    """

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> Any:
        """
        Applications must override this with a concrete QuerySet type.
        """
        raise NotImplementedError

    @classmethod
    def _scope_by_request(
        cls,
        queryset: QuerySet[Any, Any],
        request=None,
    ) -> QuerySet[Any, Any]:
        """
        Platform-global audit visibility (org-free).

        Audit rows carry no tenant partition: every authenticated caller
        sees the platform-wide log; anonymous callers see nothing.
        Row-level permission codes on each viewset's ``permission_map``
        remain the gate for restricted actions.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        return queryset

    @classmethod
    def _scope_by_user_or_organization(
        cls,
        queryset: QuerySet[Any, Any],
        request=None,
    ) -> QuerySet[Any, Any]:
        """
        Org-free alias of :meth:`_scope_by_request`.

        Kept for callers migrated off org scoping (e.g. login history):
        authenticated callers see the platform-wide log.
        """
        return cls._scope_by_request(queryset, request=request)

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        return cls.get_queryset().inactive()
