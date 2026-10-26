import contextlib
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.services.business import BusinessService
from apps.production.models import (
    ProjectMembership,
    Review,
    ReviewActivity,
    ReviewAnnotation,
    ReviewComment,
    ReviewItem,
    ReviewNote,
    ReviewParticipant,
    Version,
)
from apps.production.services.status import OVERRIDE_SELF_APPROVAL, StatusService
from apps.production.validators.references import require_project_member

#: statuses that also record the supervisor's verdict
VERDICT_STATUSES = ("Approved", "Retake", "Changes Requested")
#: decisions: a second one on the same review is a conflict, not a no-op
DECISION_STATUSES = frozenset({"Approved", "Rejected", "Changes Requested", "Retake"})


class ReviewService(BusinessService):
    model = Review

    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        *,
        actor,
        review,
        to_status,
        notes=None,
        has_permission=None,
        has_explicit=None,
        override_reason=None,
    ):
        """Move a review to ``to_status`` (workflow, permission and separation of duties checked)."""
        StatusService.transition_status(
            actor=actor,
            entity=review,
            to_status=to_status,
            reason=notes or "",
            has_permission=has_permission,
            has_explicit=has_explicit,
            override_reason=override_reason,
            strict=to_status in DECISION_STATUSES,
        )
        if to_status in VERDICT_STATUSES:
            review.supervisor_verdict = to_status
        if notes:
            cls.log(review, actor=actor, action=to_status.upper(), notes=notes)
        review.save(update_fields=["supervisor_verdict", "updated_at"])
        return review

    @classmethod
    @transaction.atomic
    def record_verdict(
        cls,
        *,
        actor,
        review,
        verdict,
        notes=None,
        has_permission=None,
        has_explicit=None,
        override_reason=None,
    ):
        """Set the supervisor verdict; Approved and Retake also move the status."""
        if verdict == "Approved" and review.status == "Approved":
            # No status moves, so the transition would not check separation of duties.
            cls.guard_approval(
                actor=actor,
                review=review,
                verdict=verdict,
                has_explicit=has_explicit,
                override_reason=override_reason,
                note="verdict",
            )
        if verdict in ("Approved", "Retake"):
            StatusService.transition_status(
                actor=actor,
                entity=review,
                to_status=verdict,
                reason=notes or "",
                has_permission=has_permission,
                has_explicit=has_explicit,
                override_reason=override_reason,
            )
        review.supervisor_verdict = verdict
        if notes:
            cls.log(review, actor=actor, action="VERDICT", verdict=verdict, notes=notes)
        review.save(update_fields=["supervisor_verdict", "updated_at"])
        return review

    @classmethod
    def guard_approval(
        cls, *, actor, review, verdict, has_explicit=None, override_reason=None, note="verdict"
    ):
        """
        Separation of duties for an approving ``verdict`` recorded without a status move
        (the verdict action on an already approved review, a participant's verdict).
        """
        if verdict != "Approved":
            return
        kind = StatusService.check_separation(
            entity=review,
            to_status="Approved",
            actor=actor,
            has_explicit=has_explicit,
            override_reason=override_reason,
        )
        if kind == OVERRIDE_SELF_APPROVAL:
            StatusService.record_override(
                entity=review,
                actor=actor,
                override_kind=kind,
                reason=override_reason or "",
                note=note,
            )

    # -- the parts of a review (WP E4, D-30) -----------------------------------------------------

    @classmethod
    def import_legacy_json(cls, review, lists: dict[str, Any]) -> list[str]:
        """
        Turn the lists a frontend mock carries (``versions``, ``reviewers``, ``comments``, ``notes``,
        ``annotations``, ``activity``) into rows, for the seed commands; a kind that already has rows is
        left alone. Returns what could not be read.
        """
        from types import SimpleNamespace

        from django.contrib.auth import get_user_model

        from apps.production.services.review_legacy import import_review

        return import_review(
            review,
            models=SimpleNamespace(
                Version=Version,
                User=get_user_model(),
                Item=ReviewItem,
                Participant=ReviewParticipant,
                Comment=ReviewComment,
                Note=ReviewNote,
                Annotation=ReviewAnnotation,
                Activity=ReviewActivity,
            ),
            only_empty=True,
            lists=lists,
        )

    @classmethod
    def log(cls, review, *, actor, action, notes="", verdict=""):
        """Add a line to the review's activity (rows are never changed afterwards)."""
        return ReviewActivity.objects.create(
            review=review,
            action=action[:50],
            verdict=verdict,
            notes=notes or "",
            actor=actor if getattr(actor, "pk", None) else None,
            actor_email=getattr(actor, "email", "") or "",
            created_by=actor if getattr(actor, "pk", None) else None,
        )

    @staticmethod
    def _name(actor) -> str:
        return (getattr(actor, "display_name", "") or getattr(actor, "email", "") or "").strip()

    @staticmethod
    def _role(actor, project) -> str:
        """The label for what the author is on this project; comes from the membership, never the request."""
        membership = (
            ProjectMembership.objects.filter(user=actor, project=project, status__iexact="active")
            .only("role")
            .first()
        )
        return membership.role if membership else ""

    @classmethod
    def add_comment(
        cls,
        *,
        actor,
        review,
        text,
        frame_number=None,
        timecode="",
        is_client_visible=True,
        tags=None,
        parent_id=None,
    ):
        """Add a comment (or a reply) written by ``actor``; whatever author the client names is ignored."""
        parent = None
        if parent_id:
            parent = cls._comment(review, parent_id)
            if parent.parent_id:  # pyright: ignore[reportAttributeAccessIssue]
                raise ValidationError({"parent_id": ["Reply to the first comment of the thread."]})
        return ReviewComment.objects.create(
            review=review,
            parent=parent,
            author=actor,
            author_name=cls._name(actor),
            text=text,
            frame_number=frame_number,
            timecode=timecode or "",
            is_client_visible=is_client_visible,
            tags=tags or [],
            created_by=actor,
        )

    @staticmethod
    def _comment(review, comment_id):
        try:
            key = UUID(str(comment_id))
        except ValueError:
            raise NotFound("Comment not found on this review.") from None
        comment = ReviewComment.objects.filter(review=review, pk=key).first()
        if comment is None:
            raise NotFound("Comment not found on this review.")
        return comment

    @classmethod
    def set_comment_resolved(cls, *, actor, review, comment_id, resolved):
        comment = cls._comment(review, comment_id)
        comment.resolved_at = timezone.now() if resolved else None
        comment.resolved_by = actor if resolved else None
        comment.updated_by = actor
        comment.save(update_fields=["resolved_at", "resolved_by", "updated_by", "updated_at"])
        return comment

    @classmethod
    def add_note(cls, *, actor, review, category="General", content="", is_pinned=False):
        return ReviewNote.objects.create(
            review=review,
            author=actor,
            author_name=cls._name(actor),
            author_role=cls._role(actor, review.project),
            category=category,
            content=content,
            is_pinned=is_pinned,
            created_by=actor,
        )

    @classmethod
    def add_annotation(
        cls, *, actor, review, comment="", frame_number=None, timecode="", drawing_coordinates=None
    ):
        return ReviewAnnotation.objects.create(
            review=review,
            author=actor,
            author_name=cls._name(actor),
            comment=comment,
            frame_number=frame_number,
            timecode=timecode or "",
            drawing_coordinates=drawing_coordinates,
            created_by=actor,
        )

    @classmethod
    @transaction.atomic
    def add_participant(cls, *, actor, review, user, role=""):
        """Ask ``user`` (an active member of the review's project) for a verdict."""
        require_project_member(review.project, user, field="user_id")
        try:
            with transaction.atomic():
                return ReviewParticipant.objects.create(
                    review=review,
                    user=user,
                    name=cls._name(user),
                    role=role,
                    created_by=actor,
                )
        except IntegrityError:
            raise ValidationError({"user_id": ["This user is already on the review."]}) from None

    @classmethod
    def participant(cls, review, ref):
        """The participant of ``review`` named by its id (or by the id the old list gave it)."""
        text = str(ref or "")
        rows = ReviewParticipant.objects.filter(review=review)
        found = None
        with contextlib.suppress(ValueError):
            found = rows.filter(pk=UUID(text)).first()
        if found is None and text:
            found = rows.filter(legacy_id=text).first()
        if found is None:
            raise NotFound("Participant not found on this review.")
        return found

    @classmethod
    @transaction.atomic
    def remove_participant(cls, *, actor, review, ref):
        from apps.core.services.soft_delete import SoftDeleteService

        row = cls.participant(review, ref)
        SoftDeleteService.delete(row, user=actor)

    @classmethod
    @transaction.atomic
    def record_participant_verdict(
        cls,
        *,
        actor,
        review,
        ref,
        verdict,
        notes="",
        can_decide_unlinked=False,
        has_explicit=None,
        override_reason=None,
    ):
        """
        Record one participant's verdict. Only the participant can; a row that names no user (converted from
        the old list) can be answered by someone holding the approve code, because nobody else could.
        """
        row = cls.participant(review, ref)
        row = ReviewParticipant.objects.select_for_update().get(pk=row.pk)
        if row.user_id is None:  # pyright: ignore[reportAttributeAccessIssue]
            if not can_decide_unlinked:
                raise PermissionDenied(
                    "This participant has no account; a reviewer who can approve must answer."
                )
        elif row.user_id != actor.pk:  # pyright: ignore[reportAttributeAccessIssue]
            raise PermissionDenied("Only the participant can record their verdict.")
        # Recording an approval is an approval, whoever the participant is.
        cls.guard_approval(
            actor=actor,
            review=review,
            verdict=verdict,
            has_explicit=has_explicit,
            override_reason=override_reason,
            note="participant verdict",
        )
        row.verdict = verdict
        row.verdict_notes = notes or ""
        row.verdict_at = timezone.now()
        row.updated_by = actor
        row.save(
            update_fields=["verdict", "verdict_notes", "verdict_at", "updated_by", "updated_at"]
        )
        cls.log(
            review, actor=actor, action="PARTICIPANT_VERDICT", verdict=verdict, notes=notes or ""
        )
        return row

    @classmethod
    @transaction.atomic
    def add_version(cls, *, actor, review, version_ref):
        """Put a version of the review's project on the review, last in the order."""
        text = str(version_ref or "")
        base = Version.objects.filter(project_id=review.project_id)
        version = None
        try:
            version = base.filter(pk=UUID(text)).first()
        except ValueError:
            version = base.filter(code__iexact=text).first() if text else None
        if version is None:
            raise ValidationError({"version_id": ["Unknown version."]})
        Review._base_manager.select_for_update().get(pk=review.pk)  # one add at a time per review
        if ReviewItem.objects.filter(review=review, version=version).exists():
            raise ValidationError({"version_id": ["This version is already on the review."]})
        last = (
            ReviewItem.all_objects.filter(review=review)
            .order_by("-position")
            .values_list("position", flat=True)
            .first()
        )
        return ReviewItem.objects.create(
            review=review,
            version=version,
            position=(last + 1) if last is not None else 0,
            created_by=actor,
        )

    @classmethod
    @transaction.atomic
    def remove_version(cls, *, actor, review, version_ref):
        from apps.core.services.soft_delete import SoftDeleteService

        try:
            key = UUID(str(version_ref))
        except ValueError:
            raise NotFound("Version not found on this review.") from None
        row = ReviewItem.objects.filter(review=review, version_id=key).first()
        if row is None:
            raise NotFound("Version not found on this review.")
        SoftDeleteService.delete(row, user=actor)
