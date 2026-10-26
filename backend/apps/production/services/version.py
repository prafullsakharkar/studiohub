from django.db import transaction

from apps.core.services.business import BusinessService
from apps.production.models import Version
from apps.production.services.status import OVERRIDE_SELF_APPROVAL, StatusService


class VersionService(BusinessService):
    model = Version

    @classmethod
    @transaction.atomic
    def promote_version(
        cls, *, actor, version, has_permission=None, has_explicit=None, override_reason=None
    ):
        """
        Make ``version`` the hero version; it is approved by the promotion.

        Promoting is an approval, so the producer of the version may not do it even
        when someone else already approved it (no status change, no transition check).
        """
        already_approved = version.status == "Approved"
        kind = ""
        if already_approved:
            kind = StatusService.check_separation(
                entity=version,
                to_status="Approved",
                actor=actor,
                has_explicit=has_explicit,
                override_reason=override_reason,
            )
        StatusService.transition_status(
            actor=actor,
            entity=version,
            to_status="Approved",
            reason="promoted",
            has_permission=has_permission,
            has_explicit=has_explicit,
            override_reason=override_reason,
        )
        if kind == OVERRIDE_SELF_APPROVAL:
            # Already approved: no transition row carried the override, so record it.
            StatusService.record_override(
                entity=version,
                actor=actor,
                override_kind=kind,
                reason=override_reason or "",
                note="promote",
            )
        version.is_hero = True
        version.save(update_fields=["is_hero", "updated_at"])
        return version
