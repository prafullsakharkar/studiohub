"""
Common ownership/scope abstract models.

These models provide reusable tenant and hierarchy boundaries
throughout the platform.

This is a protocol/interface for domain applications to implement.
Domain applications should define their own scoped fields.

Example:
    class MyModel(OrganizationScopedModel):
        organization = models.ForeignKey(
            "myapp.Organization",
            on_delete=models.CASCADE,
            related_name="%(app_label)s_%(class)ss",
            db_index=True,
        )
"""

import warnings

from django.db import models

# NOTE: The following scope classes (SequenceScopedModel, ShotScopedModel,
# TaskScopedModel, ReviewScopedModel) express domain-specific concepts used by
# production/VFX workflows. Keeping them inside `apps.core` couples the shared
# kernel to a particular vertical. They remain here for now for backwards
# compatibility but are considered deprecated at the shared-kernel level.
#
# Migration recommendation:
# - Move these classes into a domain package (e.g. `apps/production` or
#   `apps/project`) and provide a thin compatibility shim in `apps.core` that
#   re-exports the symbols and emits a deprecation warning until consumers
#   are migrated.
#
warnings.warn(
    "Core: domain-scoped base models (Sequence/Shot/Task/Review/Project) are deprecated in apps.core and should be moved to a domain package (e.g. apps.production). See docs/architecture/core-refactor-analysis.md for guidance.",
    FutureWarning,
    stacklevel=2,
)


class OrganizationScopedModel(models.Model):
    """
    Base model for organization-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own organization field.
    """

    class Meta:
        abstract = True


class ProjectScopedModel(models.Model):
    """
    Base model for project-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own project field.
    """

    class Meta:
        abstract = True


class SequenceScopedModel(models.Model):
    """
    Base model for sequence-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own sequence field.
    """

    class Meta:
        abstract = True


class ShotScopedModel(models.Model):
    """
    Base model for shot-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own shot field.
    """

    class Meta:
        abstract = True


class TaskScopedModel(models.Model):
    """
    Base model for task-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own task field.
    """

    class Meta:
        abstract = True


class ReviewScopedModel(models.Model):
    """
    Base model for review-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own review field.
    """

    class Meta:
        abstract = True


class UserScopedModel(models.Model):
    """
    Base model for user-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own user/owner field.
    """

    class Meta:
        abstract = True
