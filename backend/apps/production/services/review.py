import datetime

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.production.models import Review
from apps.production.services.status import OVERRIDE_SELF_APPROVAL, StatusService

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
            review.activity = [
                *(review.activity or []),
                {
                    "action": to_status.upper(),
                    "notes": notes,
                    "user": getattr(actor, "email", ""),
                    "timestamp": datetime.datetime.now().isoformat(),
                },
            ]
        review.save(update_fields=["supervisor_verdict", "activity", "updated_at"])
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
            review.activity = [
                *(review.activity or []),
                {"action": "VERDICT", "verdict": verdict, "notes": notes},
            ]
        review.save(update_fields=["supervisor_verdict", "activity", "updated_at"])
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
