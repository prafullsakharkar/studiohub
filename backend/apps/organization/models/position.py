from django.db import models

from apps.organization.managers.position import (
    PositionManager,
)
from apps.organization.models.base import (
    OrganizationEntityModel,
)


class Position(OrganizationEntityModel):
    """
    Organization job position.

    ``scope`` distinguishes platform-wide master catalog rows
    (``global_master``, organization is NULL) from organization-linked
    custom rows (``organization_custom``, the default, organization
    required).
    """

    class Scope(models.TextChoices):
        GLOBAL_MASTER = "global_master"
        ORGANIZATION_CUSTOM = "organization_custom"

    # Overrides OrganizationEntityModel.organization: global master rows
    # are organization-agnostic; customs must link an organization.
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        null=True,
        blank=True,
        db_index=True,
    )

    scope = models.CharField(
        max_length=32,
        choices=Scope.choices,
        default=Scope.ORGANIZATION_CUSTOM,
        db_index=True,
    )

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        related_name="positions",
        null=True,
        blank=True,
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="children",
        null=True,
        blank=True,
    )

    level = models.PositiveIntegerField(
        default=1,
    )

    is_managerial = models.BooleanField(
        default=False,
    )

    objects: PositionManager = PositionManager()

    class Meta:
        db_table = "organization_position"

        ordering = (
            "level",
            "name",
        )

        constraints = (
            models.CheckConstraint(
                condition=(
                    models.Q(
                        scope="organization_custom",
                        organization__isnull=False,
                    )
                    | models.Q(scope="global_master")
                ),
                name="position_scope_organization_link",
            ),
        )
