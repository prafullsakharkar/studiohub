"""
The parts of a review as rows (WP E4, DECISIONS D-30).

They replace the JSON lists ``versions``, ``reviewers``, ``comments``, ``notes``, ``annotations`` and
``activity`` on ``Review``. A row is one fact with a real author, so an append cannot overwrite another
one, a verdict belongs to one participant, and nothing is typed in by the client as a name. The old
JSON columns stay (unread and unwritten) until the contract phase. The related names carry ``_rows``
because ``Review.comments`` and the like are still attributes of the model.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel

PENDING = "Pending Review"


class ReviewItem(EntityModel):
    """A version shown in a review, in the order it is played."""

    review = models.ForeignKey("production.Review", on_delete=models.CASCADE, related_name="items")
    version = models.ForeignKey(
        "production.Version", on_delete=models.PROTECT, related_name="review_items"
    )
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "production_review_item"
        ordering = ("position", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["review", "version"],
                condition=models.Q(is_deleted=False),
                name="production_reviewitem_live_pair_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.review_id} #{self.position}"  # pyright: ignore[reportAttributeAccessIssue]


class ReviewParticipant(EntityModel):
    """Someone asked to give a verdict on a review; only that person records it."""

    review = models.ForeignKey(
        "production.Review", on_delete=models.CASCADE, related_name="participants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_participations",
    )
    #: the name shown when the user is unknown (a row converted from the old JSON has none)
    name = models.CharField(max_length=255, blank=True, default="")
    role = models.CharField(max_length=100, blank=True, default="")
    #: the id the old JSON list gave this entry; clients that still send it keep working
    legacy_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    verdict = models.CharField(max_length=30, default=PENDING)
    verdict_notes = models.TextField(blank=True, default="")
    verdict_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "production_review_participant"
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["review", "user"],
                condition=models.Q(is_deleted=False, user__isnull=False),
                name="production_reviewparticipant_live_user_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.review_id}: {self.name or self.user_id}"  # pyright: ignore[reportAttributeAccessIssue]


class ReviewComment(EntityModel):
    """A comment on a review, optionally on a frame, optionally a reply to another comment."""

    review = models.ForeignKey(
        "production.Review", on_delete=models.CASCADE, related_name="comment_rows"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_comments",
    )
    #: the author's name when the comment was written (or what the old JSON said)
    author_name = models.CharField(max_length=255, blank=True, default="")
    text = models.TextField(blank=True, default="")
    frame_number = models.IntegerField(null=True, blank=True)
    timecode = models.CharField(max_length=20, blank=True, default="")
    is_client_visible = models.BooleanField(default=True)
    tags = models.JSONField(default=list, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "production_review_comment"
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.review_id}: {self.text[:40]}"  # pyright: ignore[reportAttributeAccessIssue]


class ReviewNote(EntityModel):
    """A session note (category, pinned) rather than a comment on the picture."""

    review = models.ForeignKey(
        "production.Review", on_delete=models.CASCADE, related_name="note_rows"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_notes",
    )
    author_name = models.CharField(max_length=255, blank=True, default="")
    #: taken from the author's project membership, not from the request
    author_role = models.CharField(max_length=100, blank=True, default="")
    category = models.CharField(max_length=50, default="General")
    content = models.TextField(blank=True, default="")
    is_pinned = models.BooleanField(default=False)

    class Meta:
        db_table = "production_review_note"
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.review_id}: {self.category}"  # pyright: ignore[reportAttributeAccessIssue]


class ReviewAnnotation(EntityModel):
    """A drawing or marked frame on a version in the review."""

    review = models.ForeignKey(
        "production.Review", on_delete=models.CASCADE, related_name="annotation_rows"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_annotations",
    )
    author_name = models.CharField(max_length=255, blank=True, default="")
    frame_number = models.IntegerField(null=True, blank=True)
    timecode = models.CharField(max_length=20, blank=True, default="")
    comment = models.TextField(blank=True, default="")
    drawing_coordinates = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "production_review_annotation"
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.review_id}: frame {self.frame_number}"  # pyright: ignore[reportAttributeAccessIssue]


class ReviewActivity(EntityModel):
    """What happened to a review and who did it. Rows are only ever added."""

    review = models.ForeignKey(
        "production.Review", on_delete=models.CASCADE, related_name="activity_rows"
    )
    action = models.CharField(max_length=50)
    verdict = models.CharField(max_length=30, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    actor_email = models.CharField(max_length=254, blank=True, default="")

    class Meta:
        db_table = "production_review_activity"
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.review_id}: {self.action}"  # pyright: ignore[reportAttributeAccessIssue]
