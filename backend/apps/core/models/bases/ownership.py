"""
Domain-scoped ownership models - DEPRECATED.

These models have been moved to their respective domain applications.
This file is kept for backward compatibility during migration.

For new code, use the domain-specific ownership models:
- organization.OrganizationOwnedModel
- production.ProjectOwnedModel
- identity.UserOwnedModel
"""

from __future__ import annotations

from django.db import models


class OrganizationOwnedModel(models.Model):
    """
    DEPRECATED: Use organization.OrganizationOwnedModel instead.

    Adds organization ownership to a model.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class ProjectOwnedModel(models.Model):
    """
    DEPRECATED: Use production.ProjectOwnedModel instead.

    Adds project ownership to a model.
    """

    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class UserOwnedModel(models.Model):
    """
    DEPRECATED: Use identity.UserOwnedModel instead.

    Adds user ownership to a model.
    """

    user = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True
