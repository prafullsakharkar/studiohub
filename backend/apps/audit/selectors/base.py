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
        Restrict audit records to the caller's organizations.

        Audit data is sensitive; regular users must only see records for
        organizations they belong to. Only superusers (break-glass) see everything — ADR-0033 D4.
        Models with a nullable ``organization`` (e.g. pre-auth login
        history) additionally expose system-wide rows (``organization=None``)
        only to staff.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        if user.is_superuser:
            return queryset

        # Prefer the active request organization (resolved post-auth by the
        # viewset) — but only when the caller actually belongs to it
        # (request.membership is the membership in that org, or None).
        # Otherwise fall back to member orgs so a foreign header grants
        # nothing (ADR-0033 D4).
        active_org = getattr(request, "organization", None)
        active_org_id = getattr(active_org, "id", None) or (
            active_org if active_org else None
        )
        if active_org_id is not None and getattr(request, "membership", None):
            return queryset.filter(organization_id=active_org_id)

        organization_ids = list(
            user.organizations.values_list("id", flat=True),
        )

        return queryset.filter(organization_id__in=organization_ids)

    @classmethod
    def _scope_by_user_or_organization(
        cls,
        queryset: QuerySet[Any, Any],
        request=None,
    ) -> QuerySet[Any, Any]:
        """
        Scope by the requesting user for models where ``organization`` may be
        null (login history) and by organization otherwise.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        if user.is_superuser:
            return queryset

        from django.db.models import Q

        # Prefer the active request organization; fall back to the user's
        # own rows plus member orgs when the caller does not belong to it
        # (a foreign header must grant nothing — ADR-0033 D4).
        active_org = getattr(request, "organization", None)
        active_org_id = getattr(active_org, "id", None) or (
            active_org if active_org else None
        )
        if active_org_id is not None and getattr(request, "membership", None):
            return queryset.filter(
                Q(user_id=user.id) | Q(organization_id=active_org_id),
            )

        organization_ids = list(
            user.organizations.values_list("id", flat=True),
        )

        return queryset.filter(
            Q(user_id=user.id) | Q(organization_id__in=organization_ids),
        )

    @classmethod
    def for_organization(
        cls,
        organization,
    ):
        return cls.filter(
            organization=organization,
        )

    @classmethod
    def active(cls):
        return cls.get_queryset().active()

    @classmethod
    def inactive(cls):
        return cls.get_queryset().inactive()
