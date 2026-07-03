from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.identity.choices import InvitationStatus
from apps.identity.models import Invitation


class InvitationValidator:

    @staticmethod
    def validate_unique_pending_invitation(
        organization,
        email,
    ):
        exists = (
            Invitation.objects.pending()
            .filter(
                organization=organization,
                email__iexact=email,
            )
            .exists()
        )

        if exists:
            raise ValidationError("A pending invitation already exists for this email.")

    @staticmethod
    def validate_not_expired(invitation):
        if invitation.expires_at < timezone.now():
            raise ValidationError("Invitation has expired.")

    @staticmethod
    def validate_pending(invitation):
        if invitation.status != InvitationStatus.PENDING:
            raise ValidationError("Invitation is no longer pending.")
