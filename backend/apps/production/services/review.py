import datetime

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.production.models import Review
from apps.production.services.status import StatusService

#: statuses that also record the supervisor's verdict
VERDICT_STATUSES = ("Approved", "Retake", "Changes Requested")


class ReviewService(BusinessService):
    model = Review

    @classmethod
    @transaction.atomic
    def change_status(cls, *, actor, review, to_status, notes=None, has_permission=None):
        """Move a review to ``to_status`` (workflow checked, history written)."""
        StatusService.transition_status(
            actor=actor,
            entity=review,
            to_status=to_status,
            reason=notes or "",
            has_permission=has_permission,
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
    def record_verdict(cls, *, actor, review, verdict, notes=None, has_permission=None):
        """Set the supervisor verdict; Approved and Retake also move the status."""
        if verdict in ("Approved", "Retake"):
            StatusService.transition_status(
                actor=actor,
                entity=review,
                to_status=verdict,
                reason=notes or "",
                has_permission=has_permission,
            )
        review.supervisor_verdict = verdict
        if notes:
            review.activity = [
                *(review.activity or []),
                {"action": "VERDICT", "verdict": verdict, "notes": notes},
            ]
        review.save(update_fields=["supervisor_verdict", "activity", "updated_at"])
        return review
