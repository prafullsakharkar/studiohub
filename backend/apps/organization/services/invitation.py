"""
Invitation write service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.business import BusinessService
from apps.organization.events import (
    InvitationAccepted,
    InvitationActivated,
    InvitationArchived,
    InvitationCancelled,
    InvitationCreated,
    InvitationDeactivated,
    InvitationDeclined,
    InvitationDeleted,
    InvitationExpired,
    InvitationResent,
    InvitationRestored,
    InvitationUpdated,
)
from apps.organization.models import Invitation
from apps.organization.validators.invitation import (
    InvitationValidator,
)


class InvitationService(BusinessService):
    """
    Handles all write operations for invitations.
    """

    model = Invitation

    validator_class = InvitationValidator

    event_map = {
        "create": InvitationCreated,
        "update": InvitationUpdated,
        "delete": InvitationDeleted,
        "restore": InvitationRestored,
        "archive": InvitationArchived,
        "activate": InvitationActivated,
        "deactivate": InvitationDeactivated,
        "accept": InvitationAccepted,
        "decline": InvitationDeclined,
        "cancel": InvitationCancelled,
        "expire": InvitationExpired,
        "resend": InvitationResent,
    }

    @classmethod
    @transaction.atomic
    def accept(cls, instance):
        cls.validate(
            "accept",
            instance=instance,
        )

        instance.accept()

        cls.publish_event(
            "accept",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def decline(cls, instance):
        cls.validate(
            "decline",
            instance=instance,
        )

        instance.decline()

        cls.publish_event(
            "decline",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def cancel(cls, instance):
        cls.validate(
            "cancel",
            instance=instance,
        )

        instance.cancel()

        cls.publish_event(
            "cancel",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def expire(cls, instance):
        cls.validate(
            "expire",
            instance=instance,
        )

        instance.expire()

        cls.publish_event(
            "expire",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def resend(cls, instance):
        cls.validate(
            "resend",
            instance=instance,
        )

        instance.resend()

        cls.publish_event(
            "resend",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance
