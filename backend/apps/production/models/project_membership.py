"""
ProjectMembership model.

Grants a user a role/scope on a specific Project within an Organization.
Mirrors the frontend ``ProjectMembership`` contract
(``user_id/organization_id/project_id/role/roles/scope/status`` with
denormalized display fields served by the serializer).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel


class ProjectMembership(EntityModel):
    """
    Membership of a user on a project (frontend contract entity).
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="project_memberships",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="memberships",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
        db_index=True,
    )

    role = models.CharField(max_length=100, default="Artist", db_index=True)
    roles = models.JSONField(default=list, blank=True)
    scope = models.CharField(max_length=30, default="PROJECT", db_index=True)
    status = models.CharField(max_length=20, default="Active", db_index=True)

    department = models.CharField(max_length=100, blank=True, default="")
    department_id = models.CharField(max_length=50, blank=True, default="")
    team_id = models.CharField(max_length=50, blank=True, default="")
    vendor_id = models.CharField(max_length=50, blank=True, default="")
    client_id = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "production_project_membership"
        ordering = ("project", "user")
        unique_together = [("project", "user")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.user} on {self.project} ({self.role})"
