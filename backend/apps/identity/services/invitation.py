from django.db import transaction
from django.utils import timezone

from apps.core.events import EventBus
from apps.identity.choices import InvitationStatus
from apps.identity.events.invitation import (
    InvitationAccepted,
    InvitationCancelled,
    InvitationCreated,
    InvitationResent,
)
from apps.identity.models import Invitation
from apps.identity.services.base import IdentityBaseService


class InvitationService(IdentityBaseService):

    model = Invitation

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):

        invitation = cls.create_instance(
            **validated_data,
        )

        EventBus.publish(
            InvitationCreated(
                instance=invitation,
            )
        )

        return invitation

    @classmethod
    @transaction.atomic
    def accept(cls, invitation):

        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_at = timezone.now()

        invitation.save(
            update_fields=[
                "status",
                "accepted_at",
            ]
        )

        EventBus.publish(
            InvitationAccepted(
                instance=invitation,
            )
        )

        return invitation

    @classmethod
    @transaction.atomic
    def cancel(cls, invitation):

        invitation.status = InvitationStatus.CANCELLED

        invitation.save(
            update_fields=[
                "status",
            ]
        )

        EventBus.publish(
            InvitationCancelled(
                instance=invitation,
            )
        )

        return invitation

    @classmethod
    @transaction.atomic
    def resend(cls, invitation):

        EventBus.publish(
            InvitationResent(
                instance=invitation,
            )
        )

        return invitation
