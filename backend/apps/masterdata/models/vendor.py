"""
Global vendor reference model (org-removal B3).

Platform-global vendor. No organization FK: ``code`` is unique platform-wide.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import PlatformScopedModel


class Vendor(PlatformScopedModel):
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    specialization = models.CharField(max_length=100, blank=True, default="Roto & Paint")
    security_tier = models.CharField(max_length=100, blank=True, default="Standard Studio NDA")
    nda_signed = models.BooleanField(default=False)
    active_tasks_count = models.PositiveIntegerField(default=0)
    active_projects = models.JSONField(default=list, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=4.5)
    location = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=30, blank=True, default="Approved Partner", db_index=True)
    logo_url = models.URLField(max_length=500, blank=True, default="")
    bandwidth_gbps = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    # Free-text link description ("10 Gbps Dark Fiber"), not a URL.
    bandwidth_link = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "masterdata_vendor"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
