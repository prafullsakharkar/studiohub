"""
Shot model.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Upper

from apps.core.models.bases import EntityModel
from apps.production.constants import ShotStatus


class Shot(EntityModel):
    """
    Shot within a Project.
    """

    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="shots",
        db_index=True,
    )
    # Optional episodic hookup: required-by-validation (not by schema) when the
    # parent project is ``workflow_type == episodic``; the episode must belong
    # to the shot's project. Enforced in the shot viewset chain rules.
    episode = models.ForeignKey(
        "production.Episode",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shots",
        db_index=True,
    )
    # The sequence the shot belongs to; ``sequence_code`` is read from it (DECISIONS D-32).
    sequence = models.ForeignKey(
        "production.Sequence",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="shots",
    )
    code = models.CharField(max_length=30, db_index=True)
    name = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=30,
        choices=ShotStatus.choices,
        default=ShotStatus.NOT_STARTED,
        db_index=True,
    )

    frame_in = models.IntegerField(default=1001)
    frame_out = models.IntegerField(default=1100)
    handle_frames = models.PositiveIntegerField(default=8)

    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    video_url = models.URLField(max_length=500, blank=True, default="")

    assigned_artist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_shots",
    )

    supervisor_approved = models.BooleanField(default=False)
    client_approved = models.BooleanField(default=False)

    # Pipeline stages as JSON: {layout, animation, fx, lighting, comp}
    pipeline = models.JSONField(
        default=dict,
        blank=True,
        help_text="Pipeline stage statuses",
    )

    class Meta:
        db_table = "production_shot"
        ordering = ("code",)
        unique_together = [("project", "code")]
        constraints = [
            models.UniqueConstraint(
                Upper("code"), "project", name="production_shot_project_ucode_uniq"
            ),
            models.CheckConstraint(
                condition=models.Q(frame_out__gte=models.F("frame_in")),
                name="production_shot_frame_range_ck",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "sequence"]),
            models.Index(fields=["project", "code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def sequence_code(self) -> str:
        """The code of the shot's sequence ("" when it has none); filters use ``sequence__code``."""
        return self.sequence.code if self.sequence_id else ""  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]

    @property
    def frame_count(self):
        return self.frame_out - self.frame_in + 1 if self.frame_out and self.frame_in else 0

    def save(self, *args, **kwargs):
        # Default pipeline if not set
        if not self.pipeline:
            self.pipeline = {
                "layout": "Not Started",
                "animation": "Not Started",
                "fx": "Not Started",
                "lighting": "Not Started",
                "comp": "Not Started",
            }
        super().save(*args, **kwargs)
