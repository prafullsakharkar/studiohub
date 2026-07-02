from django.db.models import QuerySet

from apps.identity.models.role import Role
from apps.identity.selectors.base import IdentityBaseSelector


class RoleSelector(IdentityBaseSelector):
    """
    Read operations for Role.
    """

    model = Role

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls.model.objects.select_related("organization").prefetch_related(
            "permissions"
        )

    @classmethod
    def for_organization(
        cls,
        organization,
    ):
        return cls.get_queryset().for_organization(
            organization,
        )

    @classmethod
    def default_roles(cls):
        return cls.get_queryset().default()

    @classmethod
    def assignable(cls):
        return cls.get_queryset().assignable()

    @classmethod
    def with_permissions(cls):
        return cls.get_queryset().with_permissions()
