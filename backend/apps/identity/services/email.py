from django.utils import timezone

from apps.core.events import EventBus
from apps.identity.events.authentication import (
    EmailVerified,
    VerificationEmailSent,
)


class EmailService:
    """
    Email verification service.
    """

    @classmethod
    def send_verification_email(cls, user):
        """
        Publish verification email event.
        Email sending is handled asynchronously.
        """

        EventBus.publish(
            VerificationEmailSent(
                instance=user,
            )
        )

    @classmethod
    def verify_email(cls, user):

        user.email_verified = True

        user.email_verified_at = timezone.now()

        user.save(
            update_fields=[
                "email_verified",
                "email_verified_at",
            ]
        )

        EventBus.publish(
            EmailVerified(
                instance=user,
            )
        )

        return user
