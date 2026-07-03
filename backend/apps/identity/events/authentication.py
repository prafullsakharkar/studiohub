from apps.core.events import BaseEvent


class VerificationEmailSent(BaseEvent):
    event_type = "identity.email.verification.sent"


class EmailVerified(BaseEvent):
    event_type = "identity.email.verified"
