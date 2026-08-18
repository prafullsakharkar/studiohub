from __future__ import annotations

from django.db import models

from apps.core.models import EntityModel
from apps.identity.choices import OAuthProviderName


class OAuthProvider(EntityModel):
    """
    Stores OAuth provider configurations.
    """

    name = models.CharField(
        max_length=50,
        choices=OAuthProviderName.choices,
        unique=True,
        db_index=True,
    )

    client_id = models.CharField(
        max_length=255,
    )

    client_secret = models.CharField(
        max_length=255,
    )

    authorization_url = models.URLField()

    token_url = models.URLField()

    userinfo_url = models.URLField(
        blank=True,
    )

    scope = models.CharField(
        max_length=255,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        db_table = "identity_oauth_providers"

        ordering = ("name",)

    def __str__(self) -> str:
        return self.name
