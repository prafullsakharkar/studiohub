"""Production's reactions to its own domain events."""

from __future__ import annotations

from apps.core.events.handlers import DomainEventHandler
from apps.core.logging.logger import get_logger
from apps.production.constants import workflow

logger = get_logger("production")


class ApprovalRollupHandler(DomainEventHandler):
    """
    A version moved to ``Approved``: approve its task if the project says so (RP-3, C-RP-15).

    The bus dispatches this synchronously once the approval has committed, before the request's
    answer is sent. An error here must not turn a saved approval into a failed request, so it is
    logged and swallowed.
    """

    def handle(self, event) -> None:
        payload = event.payload
        if payload.get("entity_type") != "Version" or payload.get("to_status") != workflow.APPROVED:
            return
        from apps.production.services.approval_rollup import ApprovalRollupService

        try:
            ApprovalRollupService.roll_up(
                version_id=payload["entity_id"], actor_id=payload.get("actor_id")
            )
        except Exception:
            logger.exception(
                "approval_rollup_failed",
                version_id=payload.get("entity_id"),
                actor_id=payload.get("actor_id"),
            )
