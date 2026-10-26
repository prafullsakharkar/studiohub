from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.services.business import BusinessService
from apps.production.models import Timelog
from apps.production.services.status import StatusService


class TimelogService(BusinessService):
    model = Timelog

    @classmethod
    @transaction.atomic
    def approve(
        cls, *, actor, timelog, has_permission=None, has_explicit=None, override_reason=None
    ):
        """Submitted -> Approved by someone who did not log it; the first of two racing approvals wins."""
        StatusService.transition_status(
            actor=actor,
            entity=timelog,
            to_status="Approved",
            has_permission=has_permission,
            has_explicit=has_explicit,
            override_reason=override_reason,
            strict=True,
        )
        timelog.approved_by = actor
        timelog.approved_at = timezone.now()
        timelog.save(update_fields=["approved_by", "approved_at", "updated_at"])
        return timelog

    @classmethod
    @transaction.atomic
    def reject(
        cls, *, actor, timelog, reason, has_permission=None, has_explicit=None, override_reason=None
    ):
        """Submitted -> Rejected; the reason is required and kept with the history row."""
        reason = (reason or "").strip()
        if not reason:
            raise ValidationError(
                {"rejection_reason": ["A reason is required to reject a timelog."]}
            )
        StatusService.transition_status(
            actor=actor,
            entity=timelog,
            to_status="Rejected",
            reason=reason,
            has_permission=has_permission,
            has_explicit=has_explicit,
            override_reason=override_reason,
            strict=True,
        )
        timelog.rejection_reason = reason
        timelog.save(update_fields=["rejection_reason", "updated_at"])
        return timelog
