"""
Organization selectors.
"""

from django.db.models import QuerySet

from apps.organization.models import Organization

from .base import OrganizationBaseSelector


class OrganizationSelector(OrganizationBaseSelector):
    """
    Read-only queries for Organization.
    """

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        """
        Return the base queryset for Organization.
        """

        return Organization.objects.active().select_related(
            "created_by",
            "updated_by",
        )

    @classmethod
    def get_by_uuid(cls, uuid):
        """
        Return an organization by UUID.
        """

        return cls.get_queryset().get(uuid=uuid)

    @classmethod
    def get_by_code(cls, code):
        """
        Return an organization by code.
        """

        return cls.get_queryset().get(code=code)
