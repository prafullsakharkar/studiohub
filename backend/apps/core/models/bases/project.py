"""
Project-scoped entity base.

This is a protocol/interface for domain applications to implement.
Domain applications should define their own project field.

Example:
    class MyModel(ProjectScopedModel, EntityModel):
        project = models.ForeignKey(
            "myapp.Project",
            on_delete=models.CASCADE,
            related_name="%(app_label)s_%(class)ss",
            db_index=True,
        )
"""

from __future__ import annotations

import warnings

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.scopes import ProjectScopedModel

# This module exposes a project-scoped base model that is domain-oriented.
# Project-scoped entities are typically specific to production or project
# applications. Mark as deprecated here to encourage migration to a domain
# application (for example: apps.production.models.bases).
warnings.warn(
    "apps.core.models.bases.project.ProjectEntityModel is project-scoped and may belong in a domain application. Consider moving it to a domain package.",
    FutureWarning,
)


class ProjectEntityModel(
    ProjectScopedModel,
    EntityModel,
):
    """
    Base model for project-scoped entities.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own project field.
    """

    class Meta:
        abstract = True
