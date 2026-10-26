from django.db import transaction
from django.utils import timezone

from apps.core.services.business import BusinessService
from apps.production.exceptions import TransitionNotPermitted
from apps.production.models import Timelog
from apps.production.services.status import StatusService


class TimelogService(BusinessService):
    model = Timelog

    @classmethod
    def _refuse_own(cls, actor, timelog):
        if timelog.person_id == actor.pk and not actor.is_superuser:
            raise TransitionNotPermitted("You cannot approve or reject your own timelog.")

    @classmethod
    @transaction.atomic
    def approve(cls, *, actor, timelog, has_permission=None):
        cls._refuse_own(actor, timelog)
        StatusService.transition_status(
            actor=actor, entity=timelog, to_status="Approved", has_permission=has_permission
        )
        timelog.approved_by = actor
        timelog.approved_at = timezone.now()
        timelog.save(update_fields=["approved_by", "approved_at", "updated_at"])
        return timelog

    @classmethod
    @transaction.atomic
    def reject(cls, *, actor, timelog, reason="", has_permission=None):
        cls._refuse_own(actor, timelog)
        StatusService.transition_status(
            actor=actor,
            entity=timelog,
            to_status="Rejected",
            reason=reason,
            has_permission=has_permission,
        )
        timelog.rejection_reason = reason
        timelog.save(update_fields=["rejection_reason", "updated_at"])
        return timelog
