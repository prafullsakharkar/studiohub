from django.db import models


class RolePriority(models.IntegerChoices):
    """
    Role priority choices for organization roles.
    """

    ADMIN = 10, "Admin"
    MANAGER = 20, "Manager"
    LEAD = 30, "Lead"
    MEMBER = 40, "Member"
    GUEST = 50, "Guest"
    VIEWER = 60, "Viewer"

