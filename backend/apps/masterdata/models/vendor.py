"""
Global vendor reference model (org-removal B3).

Platform-global vendor. No organization FK: ``code`` is unique platform-wide,
ignoring case, among live rows.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower

from apps.core.models.bases import PlatformScopedModel


class Vendor(PlatformScopedModel):
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=20, db_index=True)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    specialization = models.CharField(max_length=100, blank=True, default="Roto & Paint")
    security_tier = models.CharField(max_length=100, blank=True, default="Standard Studio NDA")
    nda_signed = models.BooleanField(default=False)
    # Hand-entered; omitted from the API until a Projects selector keyed by UUID
    # exists (DECISIONS D11). Columns kept until the Phase 8 cleanup.
    active_tasks_count = models.PositiveIntegerField(default=0)
    active_projects = models.JSONField(default=list, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=4.5)
    location = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=30, blank=True, default="Approved Partner", db_index=True)
    logo_url = models.URLField(max_length=500, blank=True, default="")
    bandwidth_gbps = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    # Free-text link description ("10 Gbps Dark Fiber"), not a URL.
    bandwidth_link = models.CharField(max_length=500, blank=True, default="")

    #: Fields kept out of audit snapshots (``apps/audit/signals/change_tracking.py``).
    audit_exclude_fields = ("contact_name", "email")

    class Meta:
        db_table = "masterdata_vendor"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="masterdata_vendor_uq_code_ci",
            ),
            models.CheckConstraint(
                condition=models.Q(rating__gte=0) & models.Q(rating__lte=5),
                name="masterdata_vendor_rating_0_to_5",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
