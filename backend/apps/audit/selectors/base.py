"""
Base selector for the Audit bounded context.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.core import providers
from apps.core.selectors.base import BaseSelector

AUDIT_SCOPE = "production.audit_scope"  # offered by Production (apps/production/providers.py)


class AuditBaseSelector(BaseSelector):
    """
    Base selector for the Audit domain.

    Shared read logic for:

        - AuditLog
        - AuditTrail

    Reads are narrowed per caller by :attr:`visibility`.
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

    # How a caller's reach is narrowed (TPN review TM-012). Subclasses choose one:
    #   "project": rows of the caller's own projects (``project_id``); rows with no project are
    #              visible to platform administrators only.
    #   "own":     the caller's own rows (``owner_field``).
    #   "admin":   platform administrators only.
    # Platform administrators see every row under every mode.
    visibility = "admin"
    owner_field = "user_id"

    @classmethod
    def _visible_project_ids(cls, request) -> list[Any] | None:
        """Project ids the caller may read audit rows of; ``None`` for every project."""
        scope = providers.get(AUDIT_SCOPE)

        if scope is not None:
            return scope.visible_project_ids(request)

        # Without Production no project is known: only a superuser is not narrowed.
        user = getattr(request, "user", None)
        return None if getattr(user, "is_superuser", False) else []

    @classmethod
    def _scope_by_request(
        cls,
        queryset: QuerySet[Any, Any],
        request=None,
    ) -> QuerySet[Any, Any]:
        """
        Project-scoped audit visibility.

        Anonymous callers see nothing. ``permission_map`` codes on each viewset gate the read
        (``audit.view``); this narrows *which* rows. A caller who is not a platform administrator
        sees rows of the projects they work on (``visibility = "project"``), only their own rows
        (``"own"``), or none (``"admin"``). Internal callers with ``request=None`` are unscoped.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        project_ids = cls._visible_project_ids(request)

        if project_ids is None:
            return queryset

        if cls.visibility == "project":
            return queryset.filter(project_id__in=project_ids)

        if cls.visibility == "own":
            return queryset.filter(**{cls.owner_field: user.pk})

        return queryset.none()

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
