from django.db import models


class InvitationType(models.TextChoices):
    """
    Invitation type choices for organization invitations.
    """

    EMAIL = "email", "Email"
    SMS = "sms", "SMS"
    PHONE = "phone", "Phone"

