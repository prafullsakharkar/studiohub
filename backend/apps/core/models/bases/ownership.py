from django.db import models


class OrganizationOwnedModel(models.Model):
    """
    Abstract model for organization-scoped records.
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
    Abstract model for project-scoped records.
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
    Abstract model for user-owned records.
    """

    owner = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="owned_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True
