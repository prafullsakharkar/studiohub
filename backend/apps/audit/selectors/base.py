"""
Base selector for the Audit bounded context.
"""

from __future__ import annotations

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
    ) -> QuerySet:
        """
        Applications must override this.
        """
        raise NotImplementedError

    @classmethod
    def _scope_by_request(
        cls,
        queryset: QuerySet,
        request=None,
    ) -> QuerySet:
        """
        Restrict audit records to the caller's organizations.

        Audit data is sensitive; regular users must only see records for
        organizations they belong to. Staff and superusers see everything.
        Models with a nullable ``organization`` (e.g. pre-auth login
        history) additionally expose system-wide rows (``organization=None``)
        only to staff.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        if user.is_staff or user.is_superuser:
            return queryset

        organization_ids = list(
            user.organizations.values_list("id", flat=True),
        )

        return queryset.filter(organization_id__in=organization_ids)

    @classmethod
    def _scope_by_user_or_organization(
        cls,
        queryset: QuerySet,
        request=None,
    ) -> QuerySet:
        """
        Scope by the requesting user for models where ``organization`` may be
        null (login history) and by organization otherwise.
        """
        if request is None:
            return queryset

        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return queryset.none()

        if user.is_staff or user.is_superuser:
            return queryset

        organization_ids = list(
            user.organizations.values_list("id", flat=True),
        )

        from django.db.models import Q

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
