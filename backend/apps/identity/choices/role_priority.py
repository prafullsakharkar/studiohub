from django.db import models


class RolePriority(models.IntegerChoices):
    """
    Higher priority roles inherit greater authority.
    """

    SUPER_ADMIN = 1000, "Super Admin"
    PLATFORM_ADMIN = 900, "Platform Admin"

    STUDIO_OWNER = 800, "Studio Owner"
    STUDIO_ADMIN = 700, "Studio Administrator"

    PRODUCER = 600, "Producer"

    SUPERVISOR = 500, "Supervisor"

    LEAD = 400, "Lead"

    SENIOR_ARTIST = 300, "Senior Artist"

    ARTIST = 200, "Artist"

    REVIEWER = 100, "Reviewer"

    CLIENT = 50, "Client"
