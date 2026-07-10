from django.db import models


class HolidayType(models.TextChoices):
    """
    Types of holidays observed by an organization.
    """

    PUBLIC = "public", "Public Holiday"
    NATIONAL = "national", "National Holiday"
    RELIGIOUS = "religious", "Religious Holiday"
    COMPANY = "company", "Company Holiday"
    OPTIONAL = "optional", "Optional Holiday"
    OTHER = "other", "Other"
