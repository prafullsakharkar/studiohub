"""
Masterdata domain event subscriptions (Phase 9, ADR-0033).

Subscribes to organization lifecycle events so tenant provisioning runs
automatically on organization creation:
new org → default roles/permissions/settings/branding/calendar/master configs.
"""

from __future__ import annotations


class ProvisionOrganizationOnCreate:
    """Provision the tenant baseline whenever an organization is created."""

    def handle(self, event) -> None:
        payload = getattr(event, "payload", {}) or {}
        organization = payload.get("instance")
        if organization is None:
            return
        from apps.masterdata.services.initialization import (
            OrganizationInitializationService,
        )

        OrganizationInitializationService.initialize(organization)


def register_events() -> None:
    from apps.core.events.subscriber import subscribe
    from apps.organization.events import OrganizationCreated

    subscribe(OrganizationCreated, ProvisionOrganizationOnCreate)
