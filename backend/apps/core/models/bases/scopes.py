"""
Common ownership/scope abstract models.

These models provide reusable tenant and hierarchy boundaries
throughout the platform.
"""

from django.db import models


class OrganizationScopedModel(models.Model):
    """
    Base model for organization owned records.
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
    Base model for project owned records.
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
    Base model for sequence owned records.
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
    Base model for shot owned records.
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
    Base model for task owned records.
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
    Base model for review owned records.
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
    Base model for user owned records.
    """

    owner = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="owned_%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True
