import warnings

from django.db import models

# Warn when importing project-scoped ownership helpers — these are domain
# oriented and likely belong in a domain application.
warnings.warn(
    "apps.core.models.bases.ownership exposes ProjectOwnedModel which is project-scoped and may belong in a domain application. Consider migrating domain-scoped ownership classes out of core.",
    FutureWarning,
    stacklevel=2,
)


class OrganizationOwnedModel(models.Model):
    """
    Deprecated compatibility base — organization scope is removed.

    The platform is no longer organization-scoped. This empty abstract
    marker is retained only because ``apps.organization.models.base``
    still imports it; it dies atomically with the org app (B7). Do not
    use it in new code.
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
