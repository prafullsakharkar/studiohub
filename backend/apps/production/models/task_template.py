"""
Task templates (WP D3, DECISIONS D-27).

A template lists the tasks an entity of a kind starts with: for each item a task type from the
masterdata catalog, a name and a bid in hours. Without a project it belongs to the whole studio;
with one, to that project only. There is no inheritance: a project uses a studio template as it is
or copies it and edits the copy. Applying a template to a shot or asset never creates the same
task twice.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower

from apps.core.models.bases import EntityModel

TEMPLATE_ENTITY_TYPES = (("Shot", "Shot"), ("Asset", "Asset"))


class TaskTemplate(EntityModel):
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="task_templates",
        help_text="Empty for a studio-wide template.",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    entity_type = models.CharField(max_length=20, choices=TEMPLATE_ENTITY_TYPES, default="Shot")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "production_task_template"
        ordering = ("name",)
        constraints = [
            # Names are unique per kind within a project, and separately across the studio-wide ones
            # (two constraints because a NULL project never collides with itself in SQL).
            models.UniqueConstraint(
                Lower("name"),
                "project",
                "entity_type",
                condition=models.Q(is_deleted=False, project__isnull=False),
                name="production_tasktemplate_project_name_uniq",
            ),
            models.UniqueConstraint(
                Lower("name"),
                "entity_type",
                condition=models.Q(is_deleted=False, project__isnull=True),
                name="production_tasktemplate_studio_name_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.entity_type})"


class TaskTemplateItem(EntityModel):
    template = models.ForeignKey(TaskTemplate, on_delete=models.CASCADE, related_name="items")
    task_type = models.ForeignKey(
        "masterdata.MasterTaskType",
        on_delete=models.PROTECT,
        related_name="template_items",
    )
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    default_bid_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        db_table = "production_task_template_item"
        ordering = ("order", "created_at")
        constraints = [
            models.UniqueConstraint(
                "template",
                "task_type",
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="production_tasktemplateitem_live_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(default_bid_hours__gte=0),
                name="production_tasktemplateitem_bid_ck",
            ),
        ]

    def __str__(self):
        return f"{self.name} [{self.task_type_id}]"  # pyright: ignore[reportAttributeAccessIssue]
