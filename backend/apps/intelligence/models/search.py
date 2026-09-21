from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel


class SavedSearch(EntityModel):
    """
    Persisted global-search definition owned by a user within an organization.

    Backs ``GET/POST /api/v1/intelligence/search/saved/`` and
    ``DELETE /api/v1/intelligence/search/saved/<id>/``, replacing the former
    echo stub (which returned a hardcoded ``save-001`` id). The ``user_id``
    supplied by the frontend is never trusted — the owner is always the
    authenticated request user.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="saved_searches",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_searches",
        db_index=True,
    )
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")
    filters = models.JSONField(default=dict, blank=True)
    is_favorite = models.BooleanField(default=False)

    class Meta:
        db_table = "intelligence_saved_search"
        ordering = ("-updated_at",)
        indexes = [
            models.Index(fields=["organization", "user"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.user})"


class RecentSearch(EntityModel):
    """
    Persisted recent-search entry owned by a user within an organization.

    Backs ``GET/POST/DELETE /api/v1/intelligence/search/recent/``, replacing
    the former echo stub (hardcoded ``rec-001`` id). Collection DELETE clears
    the caller's scoped history.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="recent_searches",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recent_searches",
        db_index=True,
    )
    query = models.CharField(max_length=500, db_index=True)
    filters_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "intelligence_recent_search"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "user"]),
        ]

    def __str__(self):
        return f"{self.query} ({self.user})"
