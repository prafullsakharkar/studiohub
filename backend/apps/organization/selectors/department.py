"""
Department selectors.

Selectors are responsible for read-only queries.
"""

from __future__ import annotations

from django.db.models import Prefetch, QuerySet

from apps.organization.models import Department

from .base import OrganizationBaseSelector


class DepartmentSelector(OrganizationBaseSelector):
    """
    Read-only queries for Department.
    """

    model = Department

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return (
            cls.model.objects.active()
            .select_related(
                "organization",
                "parent",
                "manager",
                "created_by",
                "updated_by",
            )
            .prefetch_related(
                Prefetch("children"),
            )
        )

    @classmethod
    def roots(cls):
        return cls.filter(parent__isnull=True)

    @classmethod
    def children(cls, parent):
        return cls.filter(parent=parent)

    @classmethod
    def managed_by(cls, user):
        return cls.filter(manager=user)

    @classmethod
    def by_organization(cls, organization):
        return cls.filter(organization=organization)

    @classmethod
    def by_code(cls, code):
        return cls.get(code=code)

    @classmethod
    def by_uuid(cls, uuid):
        return cls.get(uuid=uuid)
