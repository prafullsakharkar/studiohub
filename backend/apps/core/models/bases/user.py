"""
User-scoped entity base.

This is a protocol/interface for domain applications to implement.
Domain applications should define their own user/owner field.

Example:
    class MyModel(UserScopedModel, EntityModel):
        owner = models.ForeignKey(
            "myapp.User",
            on_delete=models.CASCADE,
            related_name="owned_%(app_label)s_%(class)ss",
            db_index=True,
        )
"""

from __future__ import annotations

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.scopes import UserScopedModel


class UserEntityModel(
    UserScopedModel,
    EntityModel,
):
    """
    Base model for user-scoped entities.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own user/owner field.
    """

    class Meta:
        abstract = True
