"""
Project model - top-level production container.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import (
    ProjectStatus,
    ProjectType,
    ProjectWorkflowType,
)
from apps.production.validators.slate import validate_single_line


class Project(EntityModel):
    class ReviewDownloads(models.TextChoices):
        """Who may download a version's review copy (review pipeline RP-23, C-RP-56, Q-RP-105)."""

        INTERNAL = "internal", "Studio members"
        EVERYONE = "everyone", "Everyone who can see the version"
        NOBODY = "nobody", "Nobody"

    """
    Project — the top-level production container (e.g., Feature Film, Episodic Series).

    Project scope only: no organization FK. ``code`` is globally unique.
    Frontend expects many denormalized fields; we store core fields and expose
    denormalized display names via serializers/selectors.
    """

    code = models.CharField(max_length=20, unique=True, db_index=True)
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
    workflow_type = models.CharField(
        max_length=20,
        choices=ProjectWorkflowType.choices,
        default=ProjectWorkflowType.STANDARD,
        db_index=True,
        help_text=(
            "'episodic' projects bootstrap an initial episode on create and "
            "allow episode creation; 'standard' projects have no episodes."
        ),
    )

    fps = models.DecimalField(max_digits=5, decimal_places=3, default=24)
    resolution = models.CharField(max_length=50, default="4096x2160 (4K DCI)", blank=True)
    aspect_ratio = models.CharField(max_length=20, default="2.39:1", blank=True)
    color_space = models.CharField(max_length=50, default="ACEScg", blank=True)
    approve_task_on_version_approval = models.BooleanField(
        default=False,
        help_text=(
            "When on, approving a version also approves its task (review pipeline RP-3, "
            "C-RP-15). Off by default."
        ),
    )
    review_burn_ins = models.BooleanField(
        default=False,
        help_text=(
            "When on, review copies made from movies and sequences carry burn-ins: the project and "
            "record codes, the version, the date and the frame number (review pipeline RP-12, C-RP-33)."
        ),
    )
    # RP-15 (C-RP-39): how review copies of scene-referred frames are shown. ``color_space`` is their
    # input space; the view (blank = the config's default) and look (blank = none) are the studio
    # OpenColorIO config's, for its sRGB display.
    review_view = models.CharField(max_length=100, blank=True, default="")
    review_look = models.CharField(max_length=100, blank=True, default="")
    review_grades = models.BooleanField(
        default=False,
        help_text=(
            "When on, colour-managed review copies of a shot's versions carry the shot's grade, its "
            "ASC CDL (review pipeline RP-20, C-RP-53). Off by default."
        ),
    )
    # RP-18 (C-RP-47, Q-RP-83): where on studio storage this project's renders may be read from for
    # review copies of versions still in review. ``review_source_root`` is a storage root's code (as in
    # ``PUBLISHING_STORAGE_MOUNTS``), ``review_source_folder`` a relative folder on it; both blank = off.
    review_downloads = models.CharField(
        max_length=10,
        choices=ReviewDownloads.choices,
        default=ReviewDownloads.INTERNAL,
        help_text=(
            "Who may download a version's review copy: studio members who can see the version "
            "(the default), everyone who can see it (also vendors and clients), or nobody "
            "(review pipeline RP-23, C-RP-56)."
        ),
    )
    # RP-25 (C-RP-59, Q-RP-113, Q-RP-114): a slate before each downloaded movie copy, and the project's
    # own line on it; the copy that plays never carries one.
    review_slates = models.BooleanField(
        default=False,
        help_text=(
            "When on, movie and sequence review copies made from now on are downloaded with a "
            "two-second slate first; playback is unchanged (review pipeline RP-25, C-RP-59)."
        ),
    )
    review_slate_note = models.CharField(
        max_length=120,
        blank=True,
        default="",
        validators=[validate_single_line],
        help_text="One line drawn on the slate, e.g. a confidentiality notice (RP-25, C-RP-59).",
    )
    review_source_root = models.CharField(max_length=50, blank=True, default="")
    review_source_folder = models.CharField(max_length=512, blank=True, default="")

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

    def __str__(self):
        return f"{self.name} ({self.code})"
