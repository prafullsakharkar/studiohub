"""
Review model - ReviewSession
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel


class Review(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="reviews",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="reviews",
        null=True,
        blank=True,
        db_index=True,
    )

    title = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True, default="")

    entity_type = models.CharField(max_length=20, blank=True, default="Shot", db_index=True)
    entity_id = models.CharField(max_length=50, blank=True, default="", db_index=True)
    entity_code = models.CharField(max_length=50, blank=True, default="")

    status = models.CharField(
        max_length=30,
        default="Pending Review",
        db_index=True,
    )
    supervisor_verdict = models.CharField(max_length=30, blank=True, default="Pending Review")

    lead_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_reviews",
    )

    # Denormalized for frontend
    lead_reviewer_name = models.CharField(max_length=255, blank=True, default="")
    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    video_url = models.URLField(max_length=500, blank=True, default="")

    # JSON for complex nested
    versions = models.JSONField(default=list, blank=True)
    reviewers = models.JSONField(default=list, blank=True)
    comments = models.JSONField(default=list, blank=True)
    notes = models.JSONField(default=list, blank=True)
    annotations = models.JSONField(default=list, blank=True)
    activity = models.JSONField(default=list, blank=True)
    client = models.JSONField(default=dict, blank=True)
    vendor = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "production_review"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["entity_code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.title}"
