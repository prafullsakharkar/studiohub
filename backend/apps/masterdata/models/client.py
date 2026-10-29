"""
Global client reference model.

Platform-global client. No organization FK: ``code`` is unique platform-wide,
ignoring case, among live rows.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower

from apps.core.models.bases import PlatformScopedModel


class Client(PlatformScopedModel):
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=20, db_index=True)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    studio_type = models.CharField(max_length=50, blank=True, default="Major Studio")
    # Hand-entered values that nothing reliable can compute (no Projects selector
    # keyed by UUID exists yet). Omitted from the API; the column is kept until the
    # Phase 8 cleanup (DECISIONS D11).
    active_projects = models.JSONField(default=list, blank=True)
    contract_tier = models.CharField(max_length=50, blank=True, default="Standard Producer")
    portal_access = models.BooleanField(default=True)
    # Business standing label ("Active", ...), not a lifecycle: removal is soft delete.
    status = models.CharField(max_length=30, blank=True, default="Active", db_index=True)
    logo_url = models.URLField(max_length=500, blank=True, default="")
    headquarters = models.CharField(max_length=255, blank=True, default="")
    # Entered by hand: not computed, not reconciled with any billing system.
    # Needs masterdata.client.view_financial to read or write (DECISIONS D11).
    total_billed_usd = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, default=None
    )

    #: Fields kept out of audit snapshots (``apps/audit/signals/change_tracking.py``).
    audit_exclude_fields = ("contact_name", "email", "phone", "total_billed_usd")

    class Meta:
        db_table = "masterdata_client"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="masterdata_client_uq_code_ci",
            ),
            models.CheckConstraint(
                condition=models.Q(total_billed_usd__isnull=True)
                | models.Q(total_billed_usd__gte=0),
                name="masterdata_client_billed_non_negative",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
