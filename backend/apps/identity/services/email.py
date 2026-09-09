from apps.core.events import default_event_bus
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

        default_event_bus.publish(
            VerificationEmailSent(
                instance=user,
            )
        )

    @classmethod
    def verify_email(cls, user):

        user.is_email_verified = True

        user.save(
            update_fields=[
                "is_email_verified",
            ]
        )

        default_event_bus.publish(
            EmailVerified(
                instance=user,
            )
        )

        return user
