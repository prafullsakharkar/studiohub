"""
Global client contact model (org-removal B3).

Contact person for a platform-global client. No organization FK.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import PlatformScopedModel


class ClientContact(PlatformScopedModel):
    client = models.ForeignKey(
        "masterdata.Client",
        on_delete=models.CASCADE,
        related_name="contacts",
        db_index=True,
    )
    name = models.CharField(max_length=255, db_index=True)
    role = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="", db_index=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    timezone = models.CharField(max_length=100, blank=True, default="")
    portal_access = models.BooleanField(default=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "masterdata_client_contact"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["client"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.client})"
