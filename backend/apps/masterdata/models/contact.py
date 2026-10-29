"""
Shared fields of a client or vendor contact (DOM-MD-CON).

Contact data is personal data (SEC-MD-02): it is never logged, never written to
audit snapshots, and its endpoints need ``masterdata.person.view_sensitive``.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import PlatformScopedModel


class ContactBase(PlatformScopedModel):
    name = models.CharField(max_length=255, db_index=True)
    role = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="", db_index=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    timezone = models.CharField(max_length=100, blank=True, default="")
    is_primary = models.BooleanField(default=False)

    #: Fields kept out of audit snapshots (``apps/audit/signals/change_tracking.py``).
    audit_exclude_fields = ("name", "role", "email", "phone", "timezone")

    class Meta:
        abstract = True
        ordering = ("name",)
