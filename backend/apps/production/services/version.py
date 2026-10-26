from django.db import transaction

from apps.core.services.business import BusinessService
from apps.production.models import Version
from apps.production.services.status import StatusService


class VersionService(BusinessService):
    model = Version

    @classmethod
    @transaction.atomic
    def promote_version(cls, *, actor, version, has_permission=None):
        """Make ``version`` the hero version; it is approved by the promotion."""
        StatusService.transition_status(
            actor=actor,
            entity=version,
            to_status="Approved",
            reason="promoted",
            has_permission=has_permission,
        )
        version.is_hero = True
        version.save(update_fields=["is_hero", "updated_at"])
        return version
