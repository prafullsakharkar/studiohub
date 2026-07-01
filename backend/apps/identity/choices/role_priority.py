from django.db import models


class RolePriority(models.IntegerChoices):

    OWNER = 1000, "Owner"

    ADMIN = 900, "Administrator"

    SUPERVISOR = 700, "Supervisor"

    LEAD = 600, "Lead"

    ARTIST = 500, "Artist"

    REVIEWER = 300, "Reviewer"

    VIEWER = 100, "Viewer"
