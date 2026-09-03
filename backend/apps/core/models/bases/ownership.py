import warnings

from django.db import models

# Warn when importing project-scoped ownership helpers — these are domain
# oriented and likely belong in a domain application.
warnings.warn(
    "apps.core.models.bases.ownership exposes ProjectOwnedModel which is project-scoped and may belong in a domain application. Consider migrating domain-scoped ownership classes out of core.",
    FutureWarning,
)


class OrganizationOwnedModel(models.Model):
    """
    Abstract model for organization-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own organization field.

    Example:
        class MyModel(OrganizationOwnedModel):
            organization = models.ForeignKey(
                "myapp.Organization",
                on_delete=models.CASCADE,
                related_name="%(app_label)s_%(class)ss",
                db_index=True,
            )
    """

    class Meta:
        abstract = True


class ProjectOwnedModel(models.Model):
    """
    Abstract model for project-scoped records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own project field.
    """

    class Meta:
        abstract = True


class UserOwnedModel(models.Model):
    """
    Abstract model for user-owned records.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own user/owner field.
    """

    class Meta:
        abstract = True
