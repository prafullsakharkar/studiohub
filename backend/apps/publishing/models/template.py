"""
Path templates: where a file of a given type and role should live (review-pipeline RP-4, C-RP-18).

A template without a project is the studio default; a project's own template for the same file
type and role wins over it (Q-RP-23 = A). Only a template with ``enforce`` on refuses a
registration that does not match it (Q-RP-22 = B). The pattern language is in
``apps/publishing/domain/templates.py``. Templates are retired (``is_active``), never deleted.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.publishing.models.file import PublishedFile


class PublishPathTemplate(EntityModel):
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="publish_path_templates",
    )
    file_type = models.ForeignKey(
        "masterdata.MasterFileType", on_delete=models.PROTECT, related_name="+"
    )
    role = models.CharField(
        max_length=20, choices=PublishedFile.Role.choices, default=PublishedFile.Role.MAIN
    )
    storage_root = models.ForeignKey(
        "publishing.StorageRoot", on_delete=models.PROTECT, related_name="path_templates"
    )
    pattern = models.CharField(max_length=1024)
    enforce = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "publishing_path_template"
        ordering = ("project_id", "file_type_id", "role")
        constraints = [
            # One active template per key: per project, and once more for the studio default.
            models.UniqueConstraint(
                fields=["project", "file_type", "role"],
                condition=models.Q(is_active=True, is_deleted=False, project__isnull=False),
                name="publishing_template_project_key_uniq",
            ),
            models.UniqueConstraint(
                fields=["file_type", "role"],
                condition=models.Q(is_active=True, is_deleted=False, project__isnull=True),
                name="publishing_template_studio_key_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.project_id or 'studio'}:{self.file_type_id}:{self.role}"  # pyright: ignore[reportAttributeAccessIssue]
