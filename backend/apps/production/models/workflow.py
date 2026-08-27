"""
Workflow model
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel


class Workflow(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="workflows",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="workflows",
        null=True,
        blank=True,
        db_index=True,
    )

    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=50, blank=True, default="", db_index=True)
    description = models.TextField(blank=True, default="")

    category = models.CharField(max_length=50, blank=True, default="", db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    department = models.CharField(max_length=100, blank=True, default="", db_index=True)

    nodes = models.JSONField(default=list, blank=True)
    transitions = models.JSONField(default=list, blank=True)
    automation_rules = models.JSONField(default=list, blank=True)
    execution_stats = models.JSONField(default=dict, blank=True)

    is_archived = models.BooleanField(default=False)

    class Meta:
        db_table = "production_workflow"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["category"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
