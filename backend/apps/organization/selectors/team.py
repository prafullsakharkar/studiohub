from django.db.models import QuerySet

from apps.organization.models.team import Team
from apps.organization.selectors.base import OrganizationBaseSelector


class TeamSelector(OrganizationBaseSelector):
    """
    Read operations for Team entity.
    """

    model = Team

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related(
            "organization",
            "department",
            "lead",
        )

    # -----------------------------
    # Domain-specific selectors
    # -----------------------------

    @classmethod
    def by_department(cls, department):
        return cls.get_queryset().filter(department=department)

    @classmethod
    def by_lead(cls, user):
        return cls.get_queryset().filter(lead=user)

    @classmethod
    def by_code(cls, code: str):
        return cls.get_queryset().filter(code=code)

    @classmethod
    def active(cls):
        return cls.get_queryset().filter(status="active")

    @classmethod
    def for_organization(cls, organization):
        return cls.get_queryset().filter(organization=organization)
