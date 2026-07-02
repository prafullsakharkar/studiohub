from django.conf import settings
from django.db import models

from apps.organization.choices.department_type import DepartmentType
from apps.organization.managers.department import DepartmentManager
from apps.organization.models.base import OrganizationEntityModel


class Department(OrganizationEntityModel):
    """
    Department within an organization.
    """

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.PROTECT,
    )

    department_type = models.CharField(
        max_length=30,
        choices=DepartmentType.choices,
    )

    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="managed_departments",
        on_delete=models.SET_NULL,
    )

    objects = DepartmentManager()

    class Meta:
        db_table = "org_department"

        ordering = ("name",)

        indexes = [
            models.Index(fields=["organization", "code"]),
            models.Index(fields=["organization", "parent"]),
            models.Index(fields=["organization", "name"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="uniq_department_code_per_org",
            ),
        ]

        permissions = (("archive_department", "Can archive department"),)

    def __str__(self):
        return f"{self.name} ({self.code})"
