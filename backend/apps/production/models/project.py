"""
Project model - top-level production container.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.models.base import ProductionEntityModel
from apps.production.constants import ProjectType, ProjectStatus


class Project(ProductionEntityModel):
    """
    Project within an Organization (e.g., Feature Film, Episodic Series).

    Frontend expects many denormalized fields; we store core fields and expose
    denormalized display names via serializers/selectors.
    """

    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")

    type = models.CharField(
        max_length=30,
        choices=ProjectType.choices,
        default=ProjectType.FEATURE_FILM,
        db_index=True,
    )
    status = models.CharField(
        max_length=30,
        choices=ProjectStatus.choices,
        default=ProjectStatus.IN_PROGRESS,
        db_index=True,
    )

    fps = models.DecimalField(max_digits=5, decimal_places=3, default=24)
    resolution = models.CharField(max_length=50, default="4096x2160 (4K DCI)", blank=True)
    aspect_ratio = models.CharField(max_length=20, default="2.39:1", blank=True)
    color_space = models.CharField(max_length=50, default="ACEScg", blank=True)

    start_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)

    thumbnail_url = models.URLField(max_length=500, blank=True, default="")

    total_shots = models.PositiveIntegerField(default=0)
    approved_shots = models.PositiveIntegerField(default=0)
    in_progress_shots = models.PositiveIntegerField(default=0)
    total_assets = models.PositiveIntegerField(default=0)

    budget_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_projects",
    )
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_projects",
    )

    # Client/vendor denormalized (since Client/Vendor are MISSING MODELS)
    client_id = models.CharField(max_length=50, blank=True, default="")
    client_name = models.CharField(max_length=255, blank=True, default="")
    client_contact_id = models.CharField(max_length=50, blank=True, default="")
    client_contact_name = models.CharField(max_length=255, blank=True, default="")

    vendor_ids = models.JSONField(default=list, blank=True)
    vendor_names = models.JSONField(default=list, blank=True)
    vendor_team_ids = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "production_project"
        ordering = ("-created_at",)
        unique_together = [("organization", "code")]
        indexes = [
            models.Index(fields=["organization", "code"]),
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "type"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
