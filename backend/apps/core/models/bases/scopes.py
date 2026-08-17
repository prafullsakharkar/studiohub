"""
Domain-scoped models - DEPRECATED.

These models have been moved to their respective domain applications.
This file is kept for backward compatibility during migration.

For new code, use the domain-specific scoped models:
- organization.OrganizationScopedModel
- production.ProjectScopedModel
- production.SequenceScopedModel
- production.ShotScopedModel
- production.TaskScopedModel
- review.ReviewScopedModel
- identity.UserScopedModel
"""

from __future__ import annotations

from django.db import models


class OrganizationScopedModel(models.Model):
    """
    DEPRECATED: Use organization.OrganizationScopedModel instead.

    Adds organization scoping to a model.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class ProjectScopedModel(models.Model):
    """
    DEPRECATED: Use production.ProjectScopedModel instead.

    Adds project scoping to a model.
    """

    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class SequenceScopedModel(models.Model):
    """
    DEPRECATED: Use production.SequenceScopedModel instead.

    Adds sequence scoping to a model.
    """

    sequence = models.ForeignKey(
        "production.Sequence",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class ShotScopedModel(models.Model):
    """
    DEPRECATED: Use production.ShotScopedModel instead.

    Adds shot scoping to a model.
    """

    shot = models.ForeignKey(
        "production.Shot",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class TaskScopedModel(models.Model):
    """
    DEPRECATED: Use production.TaskScopedModel instead.

    Adds task scoping to a model.
    """

    task = models.ForeignKey(
        "production.Task",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class ReviewScopedModel(models.Model):
    """
    DEPRECATED: Use review.ReviewScopedModel instead.

    Adds review scoping to a model.
    """

    review = models.ForeignKey(
        "review.Review",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True


class UserScopedModel(models.Model):
    """
    DEPRECATED: Use identity.UserScopedModel instead.

    Adds user scoping to a model.
    """

    user = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True
