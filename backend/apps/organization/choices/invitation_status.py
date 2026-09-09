from django.db import models


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"

    ACCEPTED = "accepted", "Accepted"

    DECLINED = "declined", "Declined"

    EXPIRED = "expired", "Expired"

    CANCELLED = "cancelled", "Cancelled"
