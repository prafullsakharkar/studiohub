from django.db import transaction

from apps.production.models import Shot
from apps.production.services.bulk import BulkOperationService
from apps.production.services.status import StatusService


class ShotService(BulkOperationService):
    model = Shot

    @classmethod
    @transaction.atomic
    def approve_shot(cls, *, actor, shot, has_permission=None):
        """Supervisor approval: status Approved, flag set, every pipeline step Approved."""
        StatusService.transition_status(
            actor=actor, entity=shot, to_status="Approved", has_permission=has_permission
        )
        shot.supervisor_approved = True
        if shot.pipeline:
            shot.pipeline = dict.fromkeys(shot.pipeline, "Approved")
        shot.save(update_fields=["supervisor_approved", "pipeline", "updated_at"])
        return shot
