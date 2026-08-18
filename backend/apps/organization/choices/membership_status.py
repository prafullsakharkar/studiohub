from django.db import models


class MembershipStatus(models.TextChoices):
    """
    Membership status choices for organization memberships.
    """

    ACTIVE = "active", "Active"
    ON_LEAVE = "on_leave", "On Leave"
    TERMINATED = "terminated", "Terminated"
    SUSPENDED = "suspended", "Suspended"

