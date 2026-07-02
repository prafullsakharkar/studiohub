from django.db import models


class MembershipStatus(models.TextChoices):
    PENDING = "pending", "Pending"

    ACTIVE = "active", "Active"

    SUSPENDED = "suspended", "Suspended"

    INACTIVE = "inactive", "Inactive"

    TERMINATED = "terminated", "Terminated"
