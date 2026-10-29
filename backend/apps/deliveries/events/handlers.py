"""Reactions to events from other apps."""

from __future__ import annotations

from apps.core.events.handlers import DomainEventHandler


class RevokedFileHandler(DomainEventHandler):
    """A published file was revoked: unsent deliveries lose their QC, signed-off ones reopen."""

    def handle(self, event) -> None:
        from apps.deliveries.services import revocation

        payload = event.payload
        revocation.on_file_revoked(file_id=payload["file_id"], version_id=payload["version_id"])
